import { convertToSafeError, logger } from '@bdc-fos/fos-logger';
import { ErrorRequestHandler, Request, RequestHandler, Response } from 'express';
import { pki } from 'node-forge';
import { getAuditLogService } from '../common';

//* type of `req.user` field as returned by `verifyCertificateMtls` function
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace -- required to pass tests
    namespace Express {
        interface User {
            issuer: {
                attributes: pki.Attribute[]
            }
            subject: {
                attributes: pki.Attribute[]
            }
        }
    }
}

type AuditAttribute = any;
type MessageBase = any;
const { v2: auditLogging } = require('@sap/audit-logging');

export let auditLog: Awaited<ReturnType<typeof auditLogging>>;
export let lastRefreshed: number;
const TOKEN_REFRESH_TIME = 3600;

export enum AuditObjectOps {
    read = 'READ',
    create = 'CREATE',
    update = 'UPDATE',
    delete = 'DELETE',
    deploy = 'DEPLOY',
    undeploy = 'UNDEPLOY',
    import = 'IMPORT',
    upgrade = 'UPGRADE',
    manualUpgrade = 'MANUAL-UPGRADE',
    manualImport = 'MANUAL-IMPORT'
}

export enum AuditState {
    Intention = 'Intention',
    Success = 'Success',
    Failure = 'Failure'
}

export enum AuditAttributeStates {
    old = 'old',
    new = 'new'
}

export const auditUndefined = 'undefined';

export class AuditDataObject {
    id?: string;
    accountId?: string;
    applicationId?: string;
    arId?: string;
    dataSourceId?: string;
    universalId?: string;
}

export type AuditNewOldAttAry = Array<[string, string]>;

export const auditNoAttributes: AuditNewOldAttAry = [['note', 'Attributes are not known at this time']];

// Auth user data passed in options to hook function
export interface AuthUserInfo {
    subjectId: string; // authenticated subject changing/creating the DB record
    subjectType: string; // authenticated subject type
}

export const auditCreateAttributes = (obj: { [key: string]: any }): AuditAttribute[] =>
    Object.entries(obj).map(([name, v]) => ({
        name, old: auditUndefined,
        new: (v ?? auditUndefined).toString()
    }));

const refreshAuditLog = async () => {
    const credentials = getAuditLogService();
    auditLog = await auditLogging(credentials);
    lastRefreshed = Date.now();
};

export const auditConfigurationChange = async (
    namespace: `${string}.${string}`,
    operation: AuditObjectOps,
    dataObject: AuditDataObject,
    attributes: AuditAttribute[] | object,
    tenant: string,
    userId = '$USER',
    state = AuditState.Success
): Promise<void> => {
    if (!auditLog || (Date.now() - lastRefreshed) / 1000 > TOKEN_REFRESH_TIME) {
        await refreshAuditLog();
    }

    // Convert values to strings
    const dataObjectTyped = Object.fromEntries(
        Object.entries(dataObject).map(([key, value]) => [key, (value ?? auditUndefined).toString()])
    );

    const message = auditLog.configurationChange({
        type: namespace,
        id: { state: state.toUpperCase(), operation, namespace, ...dataObjectTyped }
    })
        .tenant(tenant)
        .by(userId);

    setAttributes(message, attributes);
    auditCleanAttributes(message);

    switch (state) {
        case AuditState.Intention:
            await message.logPrepare();
            break;
        case AuditState.Failure:
            await message.logFailure();
            break;
        default:
            await message.logSuccess();
            break;
    }
};

/**
 * convert object from body to attribute lisrt
 */
const auditBuildAttributeList = (req: Request, fields: '*' | string[], ignoreFields: string[]) => {
    const attributes = [];
    if (typeof req.body === 'object') {
        if (fields === '*') {
            fields = Object.keys(req.body).filter(k => !ignoreFields.includes(k) && k !== 'id');
        }

        for (const k of fields) {
            attributes.push({ name: k, old: auditUndefined, new: (req.body[k] ?? auditUndefined)?.toString() });
        }
    }
    // empty PATCH?
    if (attributes.length === 0) {
        attributes.push({ name: 'no_fields', old: auditUndefined, new: auditUndefined });
    }
    return attributes;
};

/**
 * In the library both 'old' and 'new' are required (in Audit Service not)
 * Also handle null and undefined values should they be present.
 * Convert all to strings, as numbers can be present.
 * @param message
 * @param attributesOrObj list of AuditAtribute of simple object that can be converted
 */
export const setAttributes = (message: MessageBase, attributesOrObj: AuditAttribute[] | object) => {
    // convert object to attributeArray
    const attributes = (attributesOrObj instanceof Array) ? attributesOrObj : auditCreateAttributes(attributesOrObj);

    for (const attribute of attributes) {
        const attributeClone = {
            ...attribute,
            old: (attribute?.old ?? auditUndefined).toString(),
            new: (attribute?.new ?? auditUndefined).toString()
        };
        message.attribute(attributeClone);
    }
};

/**
 * get AuditObjectOp from
 * @param method
 */
const auditOp = (method: Request['method']): AuditObjectOps => {
    switch (method) {
        case 'POST':
            return AuditObjectOps.create;
        case 'PUT':
            return AuditObjectOps.update;
        case 'PATCH':
            return AuditObjectOps.update;
        case 'DELETE':
            return AuditObjectOps.delete;
        case 'GET':
            return AuditObjectOps.read;
        default:
            logger.error(`AUDIT: unknow method ${method}`);
            return method as any;
    }
};

export interface OptionaIds { accountId?: string, universalId?: string, arId?: string };

/**
 * cleanup mess from attributes using private API. After cleanup attribute change
 * messages will look like  `{ new: 'undefined' , old: val } -> { old: val }`
 */
export const auditCleanAttributes = (message: MessageBase) => {
    const attributes: AuditAttribute[] = message._content.attributes ?? [];
    for (const attr of attributes) {
        for (const key of ['new', 'old'] as Array<keyof AuditAttribute>) {
            if (!attr[key] || attr[key] === auditUndefined) {
                delete attr[key];
            }
        }
    }
};

/**
 * collect and prepare attributes from request/response and send
 */
const auditSend = async (
    req: Request,
    res: Response, ns: string,
    entity: string,
    fields: '*' | string[],
    ignoreFields: string[],
    err?: Error
) => {
    const method = auditOp(req.method);
    // ignore GET methods
    if (method === AuditObjectOps.read) {
        return;
    }
    const auditState = (res.statusCode >= 200 && res.statusCode < 300) ? AuditState.Success : AuditState.Failure;
    let id: string = req?.params?.id ?? req?.query?.id ?? req?.body?.id;
    const attributes: AuditAttribute[] = [];

    if (auditState === AuditState.Success) {
        switch (method) {
            case AuditObjectOps.create:
                // temporary solution as headers are cleared after `send()`.
                // although marked as deprecated it should still work with Express 5
                if ('_headers' in res) {
                    const headers: { location?: string } = res._headers;
                    if ('location' in headers) {
                        id ??= headers.location.split('/')[-1];
                        attributes.push({ name: 'id', old: auditUndefined, new: id });
                    }
                }
                attributes.push(...auditBuildAttributeList(req, fields, ignoreFields));
                break;
            case AuditObjectOps.update:
                // common for both create and update
                attributes.push(...auditBuildAttributeList(req, fields, ignoreFields));
                break;
            case AuditObjectOps.delete:
                attributes.push({ name: 'id', old: id, new: auditUndefined });
                break;
        }
    } else {
        attributes.push(
            { name: 'error-status', old: auditUndefined, new: req.statusCode },
            { name: 'error-message', old: auditUndefined, new: err?.message ?? err?.toString() ?? auditUndefined }
        );
    }

    const t = Date.now();
    const universalId = req?.query?.['universal-id'] ?? req?.body?.['universal-id'];
    const arId = req?.body?.arId;
    let username = '$USER';
    // use user from certificate if available
    if (req.user) {
        username = req.user?.subject?.attributes
            ?.filter(a => ['L', 'CN'].includes(a.shortName))
            ?.map(a => a.value)
            ?.join(' ');
    }
    // $PROVIDER won't work if plan is free or standard
    const tenant = '$PROVIDER';

    await auditConfigurationChange(
        `${ns}.${entity}`,
        method,
        {
            ...(id && { id }),
            ...(universalId && { universalId }),
            ...(arId && { arId })
        },
        attributes,
        tenant,
        username,
        auditState
    );
    logger.debug(`AUDIT: took ${(Date.now() - t) / 1000 | 0} `);
};

type ApiFn<T> = (req: Request, res: Response) => Promise<T>;

/**
 * passes control to next MW/error handler
 * @param fn handler that does not pass control
 * @returns wrapped fn that calls `next/next(err)` function after completion
 */
export const attachNext = <T>(fn: ApiFn<T>): RequestHandler => async (req, res, next) => {
    try {
        await fn(req, res);
        next();
    } catch (err) {
        next(err);
    }
};

type AuditNamespace = 'dsapi' | 'dsapiCatalog' | 'dsapiSubscription' | 'dsapiDeliveryNotification';
type AuditEntity = 'dataSubscriptions' | 'dataSources' | 'deliveryNotifications';

/**
 * create middleware handling audit logs on `entity`. Watch for changes (`POST/PUT/DELETE`...) and send status and
 * all elements from `req.body` to AuditLog
 * @example:
 *     req.post('/api/entity')
 *     req.use('/api/entity', auditMW('myApi', 'entity')) // will log entity changes
 *
 * @param ns namespace to log
 * @param entity
 * @param fields list of fields to serialize, default to all (`'*'`)
 * @param ignored list of fields to ignore
 */
export const auditMW = (ns: AuditNamespace, entity: AuditEntity, fields: '*' | string[] = '*', ignored: string[] = []): [RequestHandler, ErrorRequestHandler] => {
    logger.debug(`CREATE Audit MW ${entity} on ${Array.isArray(fields) ? fields.join(', ') : fields}`);
    return [
        // handle success
        async (req, res, next) => {
            try {
                await auditSend(req, res, ns, entity, fields, ignored);
            } catch (error) {
                logger.warn('AuditLog error:', convertToSafeError(error));
            }
            next();
        },
        // handle failure
        async (exc, req, res, next) => {
            try {
                await auditSend(req, res, ns, entity, fields, ignored, exc);
            } catch (error) {
                logger.warn('AuditLog error:', convertToSafeError(error));
            }
            next(exc);
        }
    ];
};
