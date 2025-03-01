import { Request } from 'express';
import { getHealth, getLiveness, getReadiness } from '../src/health-api';
import * as utils from '../src/utils';
import { expressResponseMock } from './utils';
import { serviceInfo } from '../src/utils';

const connectDatabaseMock = jest.spyOn(utils, 'connectDatabase');
const queryDatabaseMock = jest.spyOn(utils, 'queryDatabase');
const getDatabaseHealthMock = jest.spyOn(utils, 'getDatabaseHealth');

beforeEach(() => {
    connectDatabaseMock.mockClear();
    queryDatabaseMock.mockClear();
    getDatabaseHealthMock.mockClear();
    expressResponseMock.mockReset();
});

describe('@Lighthugger Health API', () => {
    test('Succeeds', async () => {
        connectDatabaseMock.mockResolvedValueOnce({} as any);
        queryDatabaseMock.mockImplementationOnce(async () => { return await Promise.resolve([{ '?column?': 1 }]) });

        const req: Request = { headers: {}, query: {}, params: {} } as any;
        await expect(getHealth(req, expressResponseMock)).resolves.toBeUndefined();
        expect(connectDatabaseMock).toHaveBeenCalledTimes(1);
        expect(queryDatabaseMock).toHaveBeenCalledTimes(1);

        expect(expressResponseMock).toMatchObject({
            headerCalledTimes: 0,
            jsonCalledTimes: 1,
            jsonLastValue: { status: utils.HealthStatus.UP }
        });
    });

    test('Fails - connect to database', async () => {
        connectDatabaseMock.mockRejectedValueOnce(Error('MockConnectionError'));
        const req: Request = { headers: {}, query: {}, params: {} } as any;
        await expect(getHealth(req, expressResponseMock)).resolves.toBeUndefined();
        expect(connectDatabaseMock).toHaveBeenCalledTimes(1);
        expect(expressResponseMock).toMatchObject({
            headerCalledTimes: 0,
            jsonCalledTimes: 1,
            jsonLastValue: {
                status: utils.HealthStatus.DOWN, components: {
                    db: { status: utils.HealthStatus.DOWN, database: 'postgres' }
                }
            }
        });
    });

    test('Fails - database health check ', async () => {
        connectDatabaseMock.mockResolvedValueOnce({} as any);
        const queryDatabaseMock = jest.spyOn(utils, 'queryDatabase').mockImplementationOnce(async () => { return await Promise.reject(new Error('MockQueryError')) });
        const getDatabaseHealthMock = jest.spyOn(utils, 'getDatabaseHealth');

        const req: Request = { headers: {}, query: {}, params: {} } as any;
        await expect(getHealth(req, expressResponseMock)).resolves.toBeUndefined();
        expect(connectDatabaseMock).toHaveBeenCalledTimes(1);
        expect(queryDatabaseMock).toHaveBeenCalledTimes(1);
        expect(getDatabaseHealthMock).toHaveBeenCalledTimes(1);

        expect(expressResponseMock).toMatchObject({
            headerCalledTimes: 0,
            jsonCalledTimes: 1,
            jsonLastValue: {
                status: utils.HealthStatus.DOWN, serviceInfo, components: {
                    db: { status: utils.HealthStatus.DOWN, database: 'postgres' }
                }
            }
        });
    });
});

describe('@Lighthugger readiness probe', () => {
    test('Succeeds', async () => {
        connectDatabaseMock.mockResolvedValueOnce({} as any);
        queryDatabaseMock.mockImplementationOnce(async () => { return await Promise.resolve([{ '?column?': 1 }]) });

        const req: Request = { headers: {}, query: {}, params: {} } as any;
        await expect(getReadiness(req, expressResponseMock)).resolves.toBeUndefined();
        expect(connectDatabaseMock).toHaveBeenCalledTimes(1);
        expect(queryDatabaseMock).toHaveBeenCalledTimes(1);

        expect(expressResponseMock).toMatchObject({
            headerCalledTimes: 0,
            jsonCalledTimes: 1,
            jsonLastValue: { status: utils.HealthStatus.UP }
        });
    });

    test('Fails - connect to database', async () => {
        connectDatabaseMock.mockRejectedValueOnce(Error('MockConnectionError'));
        const req: Request = { headers: {}, query: {}, params: {} } as any;
        await expect(getReadiness(req, expressResponseMock)).resolves.toBeUndefined();
        expect(connectDatabaseMock).toHaveBeenCalledTimes(1);
        expect(expressResponseMock).toMatchObject({
            headerCalledTimes: 0,
            jsonCalledTimes: 1,
            jsonLastValue: {
                status: utils.HealthStatus.DOWN
            }
        });
    });

    test('Fails - database health check ', async () => {
        connectDatabaseMock.mockResolvedValueOnce({} as any);
        const queryDatabaseMock = jest.spyOn(utils, 'queryDatabase').mockImplementationOnce(async () => { return await Promise.reject(new Error('MockQueryError')) });
        const getDatabaseHealthMock = jest.spyOn(utils, 'getDatabaseHealth');

        const req: Request = { headers: {}, query: {}, params: {} } as any;
        await expect(getReadiness(req, expressResponseMock)).resolves.toBeUndefined();
        expect(connectDatabaseMock).toHaveBeenCalledTimes(1);
        expect(queryDatabaseMock).toHaveBeenCalledTimes(1);
        expect(getDatabaseHealthMock).toHaveBeenCalledTimes(1);

        expect(expressResponseMock).toMatchObject({
            headerCalledTimes: 0,
            jsonCalledTimes: 1,
            jsonLastValue: {
                status: utils.HealthStatus.DOWN
            }
        });
    });
});

describe('@Lighthugger liveness probe', () => {
    test('Succeeds', () => {
        const req: Request = { headers: {}, query: {}, params: {} } as any;
        expect(getLiveness(req, expressResponseMock)).toBeUndefined();
        expect(expressResponseMock).toMatchObject({
            headerCalledTimes: 0,
            jsonCalledTimes: 1,
            jsonLastValue: { status: utils.HealthStatus.UP }
        });
    });
});