import { StatusCodes } from 'http-status-codes';
import * as common from '../src/common';
import request from 'supertest';
import * as health from '../src/health-api';
import { app } from '../src/start';
import { logger } from '@bdc-fos/fos-logger';

jest.mock('../src/common', () => {
    const pass = (_req: any, _res: any, next: any) => next();

    return {
        setDefaultHeaders: jest.fn().mockImplementation(pass),
        requireId: jest.fn().mockImplementation(pass),
        auditMW: jest.fn().mockImplementation(pass),
        errorHandler: jest.fn().mockImplementation((err, _req, _res, next) => {
            if (err) {
                logger.error(err);
            }
            next(err);
        }),
        handleErrors: jest.fn(),
        getAppName: jest.fn().mockReturnValueOnce('mock-app')
    };
});

const setDefaultHeadersMock = jest.spyOn(common, 'setDefaultHeaders');

jest.mock('../src/health-api');
jest.mock('@bdc-fos/fos-logger', () => ({
    logger: {
        info: jest.fn(),
        debug: jest.fn()
    },
    loggerMiddleware: jest.fn().mockImplementation((_req: any, _res: any, next: any) => next()),
    convertToSafeError: jest.fn()
} as any));

describe('Health Endpoint', () => {
    test('should return UP status', async () => {
        jest.spyOn(health, 'getHealth').mockImplementationOnce(async (req, res) => {
            await Promise.resolve(logger.info('connectDatabaseMock'));
            res.status(StatusCodes.OK).json({ status: 'MOCK_STATUS' });
        });
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- test - return value is mocked
        const res = await request(app).get('/probes/health');
        expect(res).toMatchObject({
            statusCode: 200,
            header: {
                'strict-transport-security': 'max-age=31536000; includeSubDomains',
                'cross-origin-resource-policy': 'same-origin'
            }
        });
        expect(res.body).toMatchObject({ status: 'MOCK_STATUS' });
        // test some of the helmet injected settings
        expect(setDefaultHeadersMock).toHaveBeenCalled();
    });
});
