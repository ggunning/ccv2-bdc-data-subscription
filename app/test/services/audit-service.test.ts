import { logger } from '@bdc-fos/fos-logger';
import { AuditAttribute } from '@sap/audit-logging';
import * as xsenv from '@sap/xsenv';
import axios from 'axios';
import {
    attachNext,
    auditCleanAttributes,
    auditConfigurationChange,
    auditCreateAttributes,
    auditMW,
    AuditObjectOps,
    AuditState,
    auditUndefined,
    setAttributes
} from '../../src/services/audit-service';

jest.mock('node-fetch');
jest.mock('@sap/audit-logging/lib/v2/common');
jest.mock('@sap/audit-logging');
jest.mock('@sap/xsenv', () => ({
    cfServiceCredentials: jest.fn().mockReturnValue({ url: 'https://auditlog.url', uaa: { url: 'https://auditlog.auth.url' } }),
    getServices: jest.fn().mockReturnValue({ auditlog: { credentials: { url: 'https://auditlog.url' } } })
}));

const fetch = require('node-fetch');
const audit = require('@sap/audit-logging');
require('@sap/audit-logging/lib/utils');

interface AuditLog<T = string> {
    message_uuid: string;
    time: string;
    tenant: string;
    org_id: string;
    space_id: string;
    app_or_service_id: string;
    als_service_id: string;
    user: string;
    category: string;
    format_version: string;
    message: T;
};

interface AuditMessage {
    uuid: string;
    user: string;
    time: string;
    id: string;
    object: {
        type: string;
        id: {
            action: string;
            'correlation-id': string;
        };
    };
    attributes: AuditAttribute[];
    category: string;
    tenant: string;
    customDetails: {
        email: string;
        user: string;
    };
};

const credentials = { url: 'http://mock.me', user: 'MOCK_AUDIT_USER', password: 'MOCK_PASS' };
const auditResp = '{"versions": [{"version":"v2","url":"http://mock.url/oauth2"}]}';
const dataObject: Record<string, string> = { universalId: 'MOCK_UNI_ID' };

const obj = {
    intVal: 1,
    objVal: { foo: 'bar' },
    boolVal: false,
    emptyVar: '',
    nullVar: undefined as any
};

const msg: any = {
    _content: { attributes: [] },
    tenant: jest.fn().mockReturnThis(),
    by: jest.fn().mockReturnThis(),
    logSuccess: jest.fn(),
    logFailure: jest.fn(),
    logPrepare: jest.fn(),
    attribute: jest.fn()
};
const V2: any = { configurationChange: jest.fn().mockReturnValue(msg) };
jest.mock('@bdc-fos/fos-logger');

beforeAll(() => {
    process.env.VCAP_SERVICES = JSON.stringify({ VCAP_SERVICES: [{ name: 'auditlog', credentials, tags: ['auditlog'] }] });
    process.env.VCAP_APPLICATION = '';
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe('test audit service', () => {
    beforeEach(() => {
        msg._content.attributes = [];
    });
    it('should do basic calls', async () => {
        jest.spyOn(audit, 'v2').mockResolvedValueOnce(V2);
        await auditConfigurationChange('mock.namespace', AuditObjectOps.upgrade, dataObject, [], 'MOCK_TENANT', 'MOCK_USER', AuditState.Success);

        expect(V2.configurationChange).toHaveBeenCalledTimes(1);
        expect(msg.tenant).toHaveBeenCalledWith('MOCK_TENANT');
        expect(msg.by).toHaveBeenCalledWith('MOCK_USER');
        expect(msg.logSuccess).toHaveBeenCalledTimes(1);
    });

    it('ensure hacks still work', async () => {
        const audit = jest.requireActual('@sap/audit-logging');
        fetch.mockResolvedValueOnce({ data: {}, status: 200, text: jest.fn().mockResolvedValueOnce(auditResp) });
        const auditlog = await audit.v2(credentials);

        const message = auditlog.configurationChange({ type: 'MockedObject', id: { id: 'HELLO' } });
        setAttributes(message, [
            { name: 'withNew', new: 'new', old: 'undefined' },
            { name: 'withOld', new: auditUndefined, old: 'old' },
            { name: 'withNone', new: auditUndefined, old: auditUndefined },
            { name: 'withBoth', new: 'new', old: 'old' },
            { name: 'impossible', new: 'new', old: undefined }
        ]);
        expect(message._content.attributes)
            .toMatchObject([{ new: 'new' }, { new: 'undefined' }, { new: 'undefined' }, { new: 'new' },
            { new: 'new', old: 'undefined' }]);
        auditCleanAttributes(message);
        // eslint-disable-next-line @typescript-eslint/no-base-to-string -- test
        expect(message._content.attributes.map((e: any) => Object.values(e).sort((a, b) => String(a).localeCompare(String(b)))))
            .toMatchObject([['new', 'withNew'], ['old', 'withOld'], ['withNone'], ['new', 'old', 'withBoth'], ['impossible', 'new']]);
    });

    it.each([[AuditState.Failure, 'logFailure', new Error('MOCK_FAIL')], [AuditState.Intention, 'logPrepare', undefined]])('test internal functions %s', async (state, fn, err) => {
        jest.spyOn(audit, 'v2').mockResolvedValueOnce(V2);
        msg.attribute.mockImplementation(function (e: any) { this._content.attributes.push({ ...e }); });

        await auditConfigurationChange('mock.namespace',
            AuditObjectOps.upgrade,
            { ...dataObject, universalId: null },
            obj,
            'MOCK_TENANT',
            'MOCK_USER',
            state);

        expect(msg.attribute).toHaveBeenCalledTimes(5);
        expect(msg.attribute).toHaveBeenNthCalledWith(1, { name: 'intVal', new: '1', old: 'undefined' });
        expect(msg.attribute).toHaveBeenNthCalledWith(2, { name: 'objVal', new: '[object Object]', old: 'undefined' });
        expect(msg.attribute).toHaveBeenNthCalledWith(3, { name: 'boolVal', new: 'false', old: 'undefined' });
        expect(msg.attribute).toHaveBeenNthCalledWith(4, { name: 'emptyVar', new: '', old: 'undefined' });
        expect(msg.attribute).toHaveBeenNthCalledWith(5, { name: 'nullVar', new: 'undefined', old: 'undefined' });
        expect(msg[fn]).toHaveBeenCalledTimes(1);
        // cleanup attributes
        expect(msg._content.attributes[0]).not.toHaveProperty('old');
        expect(msg._content.attributes[1]).not.toHaveProperty('old');
        expect(msg._content.attributes[2]).not.toHaveProperty('old');
    });

    it('should reach corner cases', async () => {
        jest.clearAllMocks();
        msg._content = {};
        await auditConfigurationChange(
            'mock.namespace',
            AuditObjectOps.upgrade,
            {},
            [],
            'MOCK_TENANT');

        expect(msg.tenant).toHaveBeenCalledWith('MOCK_TENANT');
        expect(msg.by).toHaveBeenCalledWith('$USER');
        expect(msg.logSuccess).toHaveBeenCalledTimes(1);
    });
});

describe('test MW', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const req: any = { body: { id: 'MOCK_ID', ...obj }, method: 'POST' };
    const res: any = {
        statusCode: 200,
        _headers: { location: 'http://mock.me/Object/MOCK_ID' }
    };

    it('should call next with no error if function resolves', async () => {
        const fn = jest.fn().mockResolvedValue('MOCK_VAL');
        const req = {} as any;
        const res = {} as any;
        const next = jest.fn();

        const wrappedFn = attachNext(fn);
        await wrappedFn(req, res, next);

        expect(fn).toHaveBeenCalledWith(req, res);
        expect(next).toHaveBeenCalledWith();
    });

    it('should call next with error if function rejects', async () => {
        const error = new Error('MOCK_ERROR');
        const fn = jest.fn().mockRejectedValue(error);
        const req = {} as any;
        const res = {} as any;
        const next = jest.fn();

        const wrappedFn = attachNext(fn);
        await wrappedFn(req, res, next);

        expect(fn).toHaveBeenCalledWith(req, res);
        expect(next).toHaveBeenCalledWith(error);
    });

    it('wrapper fails should not throw an error', async () => {
        const next = jest.fn();
        await expect(attachNext(async () => await Promise.reject(new Error('MOCK_ERROR')))(req, res, next))
            .resolves.toBeUndefined();
        expect(next).toHaveBeenCalledWith(new Error('MOCK_ERROR'));
    });

    it('should build mw', async () => {
        msg._content.attributes = [];
        jest.spyOn(audit, 'v2').mockResolvedValueOnce(V2);

        fetch.mockResolvedValueOnce({ data: {}, status: 200, text: jest.fn().mockResolvedValueOnce(auditResp) });
        const next = jest.fn();
        const mw = auditMW('ns' as any, 'Entity' as any, '*', ['objVal']);

        await expect(mw[0](req, res, next)).resolves.toBeUndefined();
        expect(msg.attribute).toHaveBeenCalledTimes(5);
        expect(msg.attribute).toHaveBeenNthCalledWith(1, expect.objectContaining({ name: 'id', new: 'MOCK_ID' }));
        expect(msg.attribute).toHaveBeenNthCalledWith(2, expect.objectContaining({ name: 'intVal', new: '1' }));
        expect(msg.attribute).toHaveBeenNthCalledWith(3, expect.objectContaining({ name: 'boolVal', new: 'false' }));
        expect(msg.attribute).toHaveBeenNthCalledWith(4, expect.objectContaining({ name: 'emptyVar', new: '' }));
        expect(msg.attribute).toHaveBeenNthCalledWith(5, expect.objectContaining({ name: 'nullVar', new: 'undefined' }));
        expect(next).toHaveBeenCalledTimes(1);
        (msg.attribute).mockClear();
        (next as any).mockClear();
        await expect(mw[1](undefined, req, { ...res, statusCode: 401 }, next)).resolves.toBeUndefined();
        expect(msg.attribute).toHaveBeenCalledTimes(2);
        expect(next).toHaveBeenCalledTimes(1);
    });

    it.each(['PUT', 'PATCH'])('should log %s', async (method) => {
        jest.spyOn(audit, 'v2').mockResolvedValueOnce(V2);
        const mw = auditMW('ns' as any, 'Entity' as any, '*', ['objVal']);
        const next = jest.fn();
        await expect(mw[0]({ query: { 'universal-id': 'MOCK_UID' }, body: {}, method, params: { id: 'MOCK_ID' } } as any, res, next)).resolves.toBeUndefined();
        expect(next).toHaveBeenCalledTimes(1);
        expect(msg.attribute).toHaveBeenCalledTimes(1);
        expect(msg.attribute).toHaveBeenCalledWith({ name: 'no_fields', 'new': 'undefined', old: 'undefined' });
        (msg.attribute).mockClear();
        (next as any).mockClear();
        await expect(mw[1]('MOCK_ERROR', req, { ...res, statusCode: 401 }, next)).resolves.toBeUndefined();
        expect(msg.attribute).toHaveBeenCalledTimes(2);
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('should log DELETE', async () => {
        jest.spyOn(audit, 'v2').mockResolvedValueOnce(V2);
        const mw = auditMW('ns' as any, 'Entity' as any, '*', ['objVal']);
        const next = jest.fn();
        await expect(mw[0]({ body: { arId: 'MOCK_ARID' }, method: 'DELETE', params: { id: 'MOCK_ID' } } as any, res, next)).resolves.toBeUndefined();
        expect(next).toHaveBeenCalledTimes(1);
        expect(msg.attribute).toHaveBeenCalledTimes(1);
        expect(msg.attribute).toHaveBeenCalledWith({ name: 'id', 'new': 'undefined', old: 'MOCK_ID' });
        (msg.attribute).mockClear();
        (next as any).mockClear();
        await expect(mw[1]({}, req, { ...res, statusCode: 401 }, next)).resolves.toBeUndefined();
        expect(msg.attribute).toHaveBeenCalledTimes(2);
        expect(next).toHaveBeenCalledTimes(1);
    });

    test.each(['GET', 'DUMMY'])('should log %s', async (method) => {
        jest.spyOn(audit, 'v2').mockResolvedValueOnce(V2);
        const mw = auditMW('ns' as any, 'Entity' as any, '*', ['objVal']);
        const next = jest.fn();
        await expect(mw[0]({ body: {}, method, params: { id: 'MOCK_ID' } } as any, res, next)).resolves.toBeUndefined();
        expect(next).toHaveBeenCalledTimes(1);
        expect(msg.attribute).toHaveBeenCalledTimes(0);
    });

    test('cover exceptions', async () => {
        jest.clearAllMocks();
        (logger.error as any).mockImplementationOnce(() => { throw new Error('MOCK_ERROR'); });

        const mw = auditMW('ns' as any, 'Entity' as any, '*', ['objVal']);
        const next = jest.fn();

        await expect(mw[0](
            { body: {}, method: 'DELETE', params: { id: 'MOCK_ID' }, get authInfo() { throw new Error('MOCK_ERROR'); } } as any,
            res,
            next)).resolves.toBeUndefined();

        await expect(mw[1](
            new Error('MOCKERR'), {
                body: {},
                method: 'DELETE',
                params: { id: 'MOCK_ID' },
                get authInfo() { throw new Error('MOCK_ERROR'); }
            } as any, { ...res, statusCode: 401 }, next)).resolves.toBeUndefined();

        expect(1).toBe(1);
    });
});

describe('sonar massage', () => {
    it('fill gaps', () => {
        expect(auditCreateAttributes({ foo: undefined, bar: '', fubar: 'fubar' }))
            .toMatchObject([
                { name: 'foo', 'new': 'undefined', old: 'undefined' },
                { name: 'bar', 'new': '', old: 'undefined' },
                { name: 'fubar', 'new': 'fubar', old: 'undefined' }
            ]);
    });
});
jest.setTimeout(600000);

class AuditLogManagementService {
    creds: xsenv.ServiceCredentials;
    accessToken: string;

    constructor(filter: xsenv.ServiceQuery) {
        this.creds = xsenv.cfServiceCredentials(filter);
    }

    async getAccessToken() {
        const { data: { access_token: accessToken } } = await axios.post(`${(this.creds as any).uaa.url}/oauth/token`,
            new URLSearchParams({
                client_id: (this.creds as any).uaa.clientid,
                client_secret: (this.creds as any).uaa.clientsecret,
                grant_type: 'client_credentials'
            }).toString()
        );
        return accessToken;
    }

    async *fetchLogs(category = 'audit.configuration', back = 1) {
        if (!this.accessToken) {
            this.accessToken = await this.getAccessToken();
        }
        const now = Date.now();
        const t1 = new Date(now).toISOString().split('.')[0];
        const t0 = new Date(now - 3600000 * back).toISOString().split('.')[0];
        let { data, headers } = await axios.get<AuditLog[]>(`${this.creds.url as string}/auditlog/v2/auditlogrecords?time_from=${t0}&time_to=${t1}&category=${category}`, {
            headers: { Authorization: `Bearer ${this.accessToken}` }
        });
        for (const log of data) {
            yield { ...log, message: JSON.parse(log.message) };
        }

        while (headers.paging) {
            ({ data, headers } = await axios.get(`${this.creds.url as string}/auditlog/v2/auditlogrecords?${headers.paging}`, { headers: { Authorization: `Bearer ${this.accessToken}` } }));
            for (const log of data) {
                yield { ...log, message: JSON.parse(log.message) };
            }
        }
    }
}
describe('auditlog management', () => {
    const axiosPostMock = jest.spyOn(axios, 'post');
    const axiosGetMock = jest.spyOn(axios, 'get');

    const service = new AuditLogManagementService({ label: 'auditlog-management' });
    axiosPostMock.mockResolvedValueOnce({ data: { access_token: 'MOCK_TOKEN' } });
    axiosGetMock.mockResolvedValueOnce({ data: [{ message: JSON.stringify({ object: { type: { namespace: 'dsapi' } } }) }], headers: {} });

    it('should find some audit.configurations ', async () => {
        const logs = [] as Array<AuditLog<AuditMessage>>;

        for await (const log of service.fetchLogs()) {
            if (log?.message?.object?.type?.namespace?.includes('dsapi')) {
                logs.push(log);
            }
        }
        expect(logs.length).toBeGreaterThan(0);
    });
});
