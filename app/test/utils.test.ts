import { StatusCodes } from 'http-status-codes';
import process from 'node:process';
import { getPostgresService } from "../src/common";
import * as models from '../src/models';
import * as utils from '../src/utils';
import { connectDatabase, getAppUrl, getDatabaseHealth, getResourceUrl, HealthStatus, queryDatabase } from '../src/utils';

jest.mock('../src/common', () => ({
    getPostgresService: jest.fn().mockReturnValue({ uri: 'mock_uri', sslcert: 'mock_ssl' })
}));

afterEach(() => {
    (getPostgresService as jest.Mock).mockClear();
});

describe('test utils', () => {
    it('should return appurl', () => {
        expect(getAppUrl()).toBe('http://localhost:3000');
    });

    it('should return resourceurl', () => {
        expect(getResourceUrl('MOCK_RES')).toBe('http://localhost:3000/v0/dataSubscriptions/MOCK_RES');
    });

    it('should return resourceurl if app env set', () => {
        process.env.API_URL = 'https://mock.url';
        expect(getResourceUrl('MOCK_RES')).toBe('https://mock.url/v0/dataSubscriptions/MOCK_RES');
    });

    it('should connect to database', async () => {
        const authenticate = jest.fn();
        const initModel = jest.fn().mockReturnValueOnce({ authenticate });
        await expect(connectDatabase(initModel, 'mock_level', 'mock_schema'))
            .resolves.toMatchObject({});
        expect(authenticate).toHaveBeenCalled();
        expect(initModel).toHaveBeenCalledWith('mock_uri', expect.objectContaining({
            dialect: 'postgres',
            dialectOptions: {
                ssl: { ca: 'mock_ssl', rejectUnauthorized: true }
            }
        }));
        expect(getPostgresService).toHaveBeenCalledTimes(1);
    });

    it('should connect to database2', async () => {
        const authenticate = jest.fn();
        const initModel = jest.fn().mockReturnValueOnce({ authenticate });
        await expect(connectDatabase(initModel))
            .resolves.toMatchObject({});
        expect(authenticate).toHaveBeenCalled();
        expect(initModel).toHaveBeenCalledWith('mock_uri', expect.objectContaining({
            dialect: 'postgres',
            dialectOptions: {
                ssl: { ca: 'mock_ssl', rejectUnauthorized: true }
            }
        }));
        expect(getPostgresService).toHaveBeenCalledTimes(1);

    });

    it('should fail connect to database', async () => {
        const authenticate = jest.fn().mockRejectedValueOnce(new Error('mock error'));
        const initModel = jest.fn().mockReturnValueOnce({ authenticate });
        await expect(connectDatabase(initModel, 'mock_level', 'mock_schema'))
            .resolves.toBeUndefined(); // POZRIMA: it could throw maybe?
        expect(authenticate).toHaveBeenCalled();
        expect(initModel).toHaveBeenCalledWith('mock_uri', expect.objectContaining({
            dialect: 'postgres',
            dialectOptions: {
                ssl: { ca: 'mock_ssl', rejectUnauthorized: true }
            }
        }));
        expect(getPostgresService).toHaveBeenCalledTimes(1);
    });

    it('should query database successfully', async () => {
        const query = 'SELECT 1';
        const queryResult = [[{ '1': 1 }], []];
        const database = { query: jest.fn().mockResolvedValueOnce(queryResult) } as any;
        const result = await queryDatabase(database, query);
        expect(result).toEqual(queryResult);
        expect(database.query).toHaveBeenCalledWith(query);
    });

    it('should fail to query database', async () => {
        const query = 'SELECT 1';
        const database = { query: jest.fn().mockRejectedValueOnce(new Error('mock error')) } as any;
        const result = await queryDatabase(database, query);
        expect(result).toBeUndefined();
        expect(database.query).toHaveBeenCalledWith(query);
    });

    it('should return database health as UP', async () => {
        const connectDatabaseMock = jest.spyOn(utils, 'connectDatabase');
        const initModelsMock = jest.spyOn(models, 'initModels');
        const queryDatabaseMock = jest.spyOn(utils, 'queryDatabase');

        const queryResult = [[{ '1': 1 }], []];
        const database = { query: jest.fn().mockResolvedValueOnce(queryResult) } as any;
        initModelsMock.mockReturnValueOnce(database);
        connectDatabaseMock.mockResolvedValueOnce(database);
        queryDatabaseMock.mockResolvedValueOnce([{ '?column?': 1 }]);
        const result = await getDatabaseHealth();
        expect(result).toEqual({ statusCode: StatusCodes.OK, status: HealthStatus.UP });
    });

    it('should return database health as DOWN', async () => {
        const connectDatabaseMock = jest.spyOn(utils, 'connectDatabase');
        const initModelsMock = jest.spyOn(models, 'initModels');
        const queryDatabaseMock = jest.spyOn(utils, 'queryDatabase');

        const database = { query: jest.fn().mockRejectedValueOnce(new Error('mock error')) } as any;
        initModelsMock.mockReturnValueOnce(database);
        connectDatabaseMock.mockResolvedValueOnce(database);
        queryDatabaseMock.mockResolvedValueOnce(undefined);
        const result = await getDatabaseHealth();
        expect(result).toEqual({ statusCode: StatusCodes.SERVICE_UNAVAILABLE, status: 'DOWN' });
    });

    afterEach(() => {
        delete process.env.APP_URL;
    });
});
