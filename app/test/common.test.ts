import { logger } from '@bdc-fos/fos-logger';
import xsenv from '@sap/xsenv';
import { AxiosError } from 'axios';
import { Request, Response } from 'express';
import * as fs from 'fs';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import process from 'node:process';
import { OptimisticLockError } from 'sequelize';
import {
    ClientError,
    errorHandler,
    getAppName,
    getAuditLogService,
    handleApiError,
    handleErrors, isString,
    requireId,
    setDefaultHeaders,
    validateInput
} from '../src/common';

jest.mock('@bdc-fos/fos-logger');

jest.mock('fs');
const readFileSyncMock = jest.spyOn(fs, 'readFileSync');

describe('Test basics', () => {
    it('should test getAppName', () => {
        process.env.APP_NAME = 'mock-app';
        expect(getAppName()).toBe('mock-app');
    });

    it('should test string', () => {
        expect(isString('test')).toBeTruthy();
        expect(isString(new String('test'))).toBeTruthy();
        expect(isString(123)).toBeFalsy();
    });

    it('should test errorHandler', () => {
        const next = jest.fn();
        const send = jest.fn();
        const status = jest.fn().mockReturnValueOnce({ send });

        expect(errorHandler(new Error(), {} as Request, { status, send } as any, next)).toBeUndefined();
        expect(next).toHaveBeenCalledTimes(1);
        expect(status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
    });

    afterEach(() => {
        delete process.env.APP_NAME;
    });
});

describe('Test getAuditLogService', () => {
    test('Success', () => {
        xsenv.getServices = jest.fn().mockImplementationOnce(() => {
            return { auditlog: 'MockedAuditLog' };
        });

        getAuditLogService();
        expect(xsenv.getServices).toHaveBeenCalledTimes(1);
    });
});

const jsonSchema = `{
    "$id": "data-subscription-scheduled-schema",
    "type": "object",
    "title": "Data subscription scheduled schema",
    "required": [
        "subscriber",
        "producer",
        "dataSourceId",
        "schedule",
        "destinationPath"
    ],
    "additionalProperties": false,
    "properties": {
        "subscriber": {
            "type": "string",
            "maxLength": 64,
            "pattern": "^/[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+$",
            "examples": [
                "/us-west-2/prism/Account123"
            ]
        },
        "producer": {
            "type": "string",
            "maxLength": 64,
            "pattern": "^/[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+$",
            "examples": [
                "/us-west-2/ariba/TENANT123"
            ]
        },
        "dataSourceId": {
            "type": "string",
            "examples": [
                "JobPosting"
            ]
        },
        "schedule": {
            "type": "string"
        },
        "beginWatermark": {
            "type": "string",
            "format": "date-time"
        },
        "destinationPath": {
            "type": "string",
            "format": "uri-reference",
            "examples": [
                "/store/fieldglass/us-west-2/fg-tenant-123/delivery-batch123"
            ]
        }
    }
}`;

describe('validate subscription scheduled schema', () => {
    beforeEach(() => {
        readFileSyncMock.mockReset();
    });

    test('Success', () => {
        readFileSyncMock.mockReturnValueOnce(jsonSchema);
        const subscription = {
            subscriber: '/us-west-2/prism/Account123',
            producer: '/us-west-2/ariba/TENANT123',
            schedule: '0 8 * * *',
            dataSourceId: 'JobPosting',
            destinationPath: 'https://destination.url'
        };
        expect(() => validateInput('./resources/data-subscription-scheduled-schema.json', subscription)).not.toThrow();
    });

    test('Fail - empty', () => {
        readFileSyncMock.mockReturnValueOnce(jsonSchema);
        expect(() => validateInput('./resources/data-subscription-scheduled-schema.json', undefined)).toThrow(new Error('Missing body'));
    });

    test('Fail - wrong object', () => {
        readFileSyncMock.mockReturnValueOnce(jsonSchema);
        expect(() => validateInput('./resources/data-subscription-scheduled-schema.json', {}))
            .toThrow(new Error('Validation by schema has failed. data must have required property \'subscriber\', data must have required'));
    });
});

describe('setDefaultHeaders', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    const nextMock = jest.fn();
    const setMock = jest.fn();
    test('Success', () => {
        setDefaultHeaders({} as Request, { set: setMock } as any, nextMock);
        expect(setMock).toHaveBeenCalledTimes(4);
        expect(setMock).toHaveBeenNthCalledWith(1, 'Date', expect.any(String));
        expect(setMock).toHaveBeenNthCalledWith(2, 'Cache-Control', 'no-store, must-revalidate, proxy-revalidate');
        expect(setMock).toHaveBeenNthCalledWith(3, 'Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self';");
        expect(setMock).toHaveBeenNthCalledWith(4, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
        expect(nextMock).toHaveBeenCalled();
    });
});

describe('requireId', () => {
    const sendMock = jest.fn().mockReturnValue('Parameter "id" is required');
    const resMock: Response = {
        status: jest.fn().mockReturnValue({ send: sendMock })
    } as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const nextMock = jest.fn();

    test('Success', () => {
        expect(requireId({ params: { id: '9a50b6e3-3f90-423f-8f04-c1887fffd856' } } as any, resMock, nextMock))
            .toBeUndefined();
        expect(nextMock).toHaveBeenCalled();
    });

    test('Parameter "id" is required',  () => {
        expect(requireId({ params: { id: null } } as any, resMock, nextMock))
            .toBeUndefined();
        expect(resMock.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(sendMock).toHaveBeenCalledWith('Parameter "id" is required');
        expect(nextMock).not.toHaveBeenCalled();
    });

    test('Parameter "id" must be UUID', () => {
        expect(requireId({ params: { id: '9a50b6e3-3f90-423f-8f04-c1887fffd856-XXXXX' } } as any, resMock, nextMock))
            .toBeUndefined();
        expect(resMock.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(sendMock).toHaveBeenCalledWith('Parameter "id" must be UUID');
        expect(nextMock).not.toHaveBeenCalled();
    });
});

describe('Error Handling', () => {
    const processMock: jest.MockedObject<NodeJS.Process> = {
        on: jest.fn(),
        once: jest.fn(),
        exit: jest.fn(),
        kill: jest.fn()
    } as any;

    beforeEach(() => jest.resetAllMocks());

    test('Should handle rejected', () => {
        const callbacks: Array<(...args: any[]) => void> = [];
        processMock.on.mockImplementation((event, cb) => callbacks.push(cb) as any);

        handleErrors(processMock as any);

        expect(callbacks).toHaveLength(2);
        expect(processMock.on).toHaveBeenCalledTimes(2);
        expect(processMock.once).toHaveBeenCalledTimes(3);
        processMock.exit.mockImplementationOnce(() => {
            throw new Error('MOCK');
        });
        processMock.exit.mockReturnThis();
        expect(callbacks[0]()).toBeUndefined();
        expect(processMock.exit).toHaveBeenCalledTimes(2);
    });

    test('Should handle signals', () => {
        const callbacks: Array<(...args: any[]) => void> = [];
        processMock.once.mockImplementation((event, cb) => callbacks.push(cb) as any);

        handleErrors(processMock as any);

        expect(callbacks).toHaveLength(3);
        expect(callbacks[0]()).toBeUndefined();
        expect(processMock.kill).toHaveBeenCalledTimes(1);
    });
});

const mockResponse = () => {
    const res: Partial<Response> = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
    };
    return res as Response;
};

describe('test handApiError', () => {
    test('Should handle AxiosError', () => {
        const res = mockResponse();

        jest.mock('axios', () => ({
            isAxiosError: jest.fn().mockReturnValue(true)
        }));
        const error = {
            isAxiosError: true,
            toJSON: jest.fn().mockReturnValue('AxiosError'),
            response: {
                data: 'Some response data'
            }
        } as unknown as AxiosError;

        handleApiError(error, res);

        expect(logger.error).toHaveBeenCalledTimes(3);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(res.send).toHaveBeenCalledWith(ReasonPhrases.INTERNAL_SERVER_ERROR);
    });

    test('should handle OptimisticLockError with PRECONDITION_FAILED', () => {
        const res = mockResponse();
        const error = new OptimisticLockError({});

        handleApiError(error, res);

        expect(logger.error).toHaveBeenCalledWith('Error (handleApiError):', undefined);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.PRECONDITION_FAILED);
        expect(res.send).toHaveBeenCalledWith('Provided ETag does not match current version of resource');
    });

    test('should handle ClientError', () => {
        const res = mockResponse();
        const error = new ClientError('ClientError');

        handleApiError(error, res);

        expect(logger.error).toHaveBeenCalledWith('Error (handleApiError):', undefined);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith('ClientError');
    });
});
