import { convertToSafeError, logger } from '@bdc-fos/fos-logger';
import xsenv from '@sap/xsenv';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import axios, { AxiosError } from 'axios';
import { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import { readFileSync } from 'fs';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { OptimisticLockError } from 'sequelize';
import validator from 'validator';

interface PgCreds {
    uri: string;
    sslcert: string;
    // ...etc
}

export const getAuditLogService = (): any => xsenv.getServices({ auditlog: { tag: 'auditlog' } }).auditlog;
export const getPostgresService = () => xsenv.getServices<{ pg: PgCreds } >({ pg: { tag: 'postgresql' } }).pg;

export const isString = (input: any): boolean => typeof (input) === 'string' || input instanceof String;
export const getAppName = (): string => process.env.APP_NAME;

export class AuthorizationError extends Error {
    constructor(public message: string) {
        super(message);
        Object.setPrototypeOf(this, AuthorizationError.prototype);
    }
}

export class SchemaValidationError extends Error {
    constructor(public message: string) {
        super(message);
        Object.setPrototypeOf(this, SchemaValidationError.prototype);
    }
}

export class ClientError extends Error {
    constructor(public message: string) {
        super(message);
        Object.setPrototypeOf(this, ClientError.prototype);
    }
}

// Error handler for API errors
export const handleApiError = (error: Error | AxiosError, res: Response) => {
    logger.error('Error (handleApiError):', convertToSafeError(error));
    if (axios.isAxiosError(error)) {
        logger.error(error.toJSON());
        logger.error(error.response?.data);
    }
    if (error instanceof AuthorizationError) {
        res.status(StatusCodes.UNAUTHORIZED).send(error.message);
    } else if (error instanceof ClientError || error instanceof SchemaValidationError) {
        res.status(StatusCodes.BAD_REQUEST).send(error.message);
    } else if (error.constructor.name === OptimisticLockError.prototype.constructor.name) {
        res.status(StatusCodes.PRECONDITION_FAILED).send('Provided ETag does not match current version of resource');
    } else {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(ReasonPhrases.INTERNAL_SERVER_ERROR);
    }
};

/**
 * Error handling middleware
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    handleApiError(err, res);
    next(err);
};

// Validate input with json schema
export function validateInput<T>(schemaPath: string, json: Partial<T>): asserts json is T {
    logger.debug('validateInput started');
    if (!json) {
        throw new SchemaValidationError('Missing body');
    }

    const schemaValidator = new Ajv({ allErrors: true, verbose: true, allowMatchingProperties: true });
    addFormats(schemaValidator);
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
    const isValid = schemaValidator.validate(schema, json);
    if (!isValid) {
        logger.error(`Validation by schema has failed: ${schemaValidator.errorsText()}`);
        throw new SchemaValidationError(`Validation by schema has failed. ${schemaValidator.errorsText()?.substring(0, 70)}`);
    }
};

// Middleware to set default headers
export const setDefaultHeaders = (req: Request, res: Response, next: NextFunction): void => {
    res.set('Date', (new Date()).toUTCString());
    res.set('Cache-Control', 'no-store, must-revalidate, proxy-revalidate');
    res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self';");
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    next();
};

// Check existence and format of received id
export const requireId: RequestHandler = (req, res, next) => {
    const id = req.params?.id;
    if (!id) {
        res.status(StatusCodes.BAD_REQUEST).send('Parameter "id" is required');
    } else if (!isString(id) || !validator.isUUID(id)) {
        res.status(StatusCodes.BAD_REQUEST).send('Parameter "id" must be UUID');
    } else {
        next();
    }
};

export const handleErrors = (process: NodeJS.Process) => {
    // Gracefully disconnect producer in case of error or signal
    // Gracefully disconnect producer in case of error or signal
    ['unhandledRejection', 'uncaughtException'].forEach((errorType) => {
        process?.on(errorType, () => {
            try {
                logger.error(`Error: ${errorType}`);
                process.exit(0);
            } catch (err) {
                logger.error(convertToSafeError(err));
                process.exit(1);
            }
        });
    });

    ['SIGTERM', 'SIGINT', 'SIGUSR2'].forEach((signalTrap) => {
        process.once(signalTrap, () => {
            try {
                logger.info(`Signal obtained: ${signalTrap}`);
            } finally {
                process.kill(process.pid, signalTrap);
            }
        });
    });
};
