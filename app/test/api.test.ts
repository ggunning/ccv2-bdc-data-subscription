import express from 'express';
import { StatusCodes } from 'http-status-codes';
import * as target from '../src/api';
import * as common from '../src/common';
import { DataSubscription } from '../src/models/data-subscription';
import * as utils from '../src/utils';
import { expressResponseMock } from './utils';

jest.setTimeout(10000);

const validateInputMock = jest.spyOn(common, 'validateInput');
const connectDatabaseMock = jest.spyOn(utils, 'connectDatabase').mockImplementation(async (): Promise<any> => {
    return await Promise.resolve({
        transaction: jest.fn().mockImplementation(() => {
            return {
                commit: jest.fn(),
                rollback: jest.fn()
            };
        })
    });
});

// Mock models
const models = require('../src/models');
const loadModelsMock = jest.spyOn(models, 'loadModels').mockReturnValue({});

const getResourceUrlMock = jest.spyOn(utils, 'getResourceUrl');

const generateRecords = (count: number, oneTenant: boolean): Array<{ id: string, producer: string }> => {
    const records = [];
    for (let i = 1; i <= count; i++) {
        if (oneTenant) {
            records.push({ id: `${i}`, producer: `/us-west-2/ariba/TENANT1` });
        } else {
            records.push({ id: `${i}`, producer: `/us-west-2/ariba/TENANT${i}` });
        }
    }
    return records;
}

// Mock test-model.ts
jest.mock('../src/models/data-subscription', () => {
    return {
        DataSubscription: {
            findAll: jest.fn().mockImplementation(async () => { return await Promise.resolve(null); }),
            findByPk: jest.fn().mockImplementation(async () => {
                return await Promise.resolve({
                    update: jest.fn().mockImplementation(async () => { return await Promise.resolve(null); }),
                    destroy: jest.fn().mockImplementationOnce(async () => { return await Promise.resolve(null); })

                });
            }),
            findOne: jest.fn().mockImplementation(async () => { return await Promise.resolve(null); }),
            update: jest.fn().mockImplementation(async () => { return await Promise.resolve(null); }),
            create: jest.fn(),
            init: jest.fn(),
            hasMany: jest.fn()
        }
    };
});

const dataSubscriptionFindOneMock = jest.spyOn(DataSubscription, 'findOne');
const dataSubscriptionCreateMock = jest.spyOn(DataSubscription, 'create');
const dataSubscriptionInitMock = jest.spyOn(DataSubscription, 'init');
const dataSubscriptionFindByPkMock = jest.spyOn(DataSubscription, 'findByPk');
const dataSubscriptionFindAllMock = jest.spyOn(DataSubscription, 'findAll');

const mockedExpressResponse = expressResponseMock as unknown as express.Response;

beforeAll(() => {
    process.env.APP_NAME = 'MockedAppName';
});

beforeEach(() => {
    loadModelsMock.mockClear();
    dataSubscriptionFindAllMock.mockClear();
    dataSubscriptionFindByPkMock.mockClear();
    dataSubscriptionFindOneMock.mockClear();
    dataSubscriptionCreateMock.mockClear();
    dataSubscriptionInitMock.mockClear();
    connectDatabaseMock.mockClear();
    expressResponseMock.mockReset();
    getResourceUrlMock.mockClear();
    validateInputMock.mockClear();
});

describe('Test create Data subscription', () => {
    test('ess - create subscription', async () => {
        const subscription = {
            subscriber: '/us-west-2/prism/Account123', producer: '/us-west-2/ariba/TENANT123', dataSourceId: 'JobPosting', schedule: '0 8 * * *',
            beginWatermark: '2023-02-01T18:49:01.211Z', destinationPath: 'store/fieldglass/us-west-2/tenant123'
        };
        const request = {} as express.Request;
        request.body = subscription;
        request.headers = { 'bdcfos-producer-tenantid': 'TENANT123' };
        dataSubscriptionCreateMock.mockReturnValueOnce({
            id: 'aa5c6521-62fe-462d-9df4-66a668481526',
            ...subscription
        });
        await expect(target.createDataSubscription(request, mockedExpressResponse))
            .resolves.toBeUndefined();

        expect(connectDatabaseMock).toHaveBeenCalledTimes(1);
        expect(loadModelsMock).toHaveBeenCalledTimes(1);
        expect(dataSubscriptionCreateMock).toHaveBeenCalledTimes(1);
        // expect(dataSubscriptionCreateMock).toHaveBeenNthCalledWith(1, subscription);

        expect(expressResponseMock.headerCalledTimes).toBe(1);
        expect(expressResponseMock.headerLastKey).toBe('Location');
        expect(expressResponseMock.headerLastValue).toMatch(/\/v0\/dataSubscriptions\/aa5c6521-62fe-462d-9df4-66a668481526$/);

        expect(expressResponseMock.statusCalledTimes).toBe(1);
        expect(expressResponseMock.statusLastValue).toBe(201);

        expect(expressResponseMock.sendCalledTimes).toBe(1);
        expect(expressResponseMock.sendLastValue).toBe('aa5c6521-62fe-462d-9df4-66a668481526');
    });

    test('fail - error on validation', async () => {
        const request = {} as express.Request;
        request.body = { 'bad-body': 'xx' };
        request.headers = { 'bdcfos-producer-tenantid': 'TENANT123' };
        validateInputMock.mockImplementationOnce(() => { throw new Error(); });
        await target.createDataSubscription(request, mockedExpressResponse);

        expect(expressResponseMock.statusCalledTimes).toBe(1);
        expect(expressResponseMock.statusLastValue).toBe(StatusCodes.BAD_REQUEST);
    });

    test('fail - conflict', async () => {
        const request = {} as express.Request;
        const body = {
            subscriber: '/us-west-2/prism/Account123', producer: '/us-west-2/ariba/TENANT123', dataSourceId: 'JobPosting', schedule: '0 8 * * *',
            beginWatermark: '2023-02-01T18:49:01.211Z', destinationPath: 'store/fieldglass/us-west-2/tenant123'
        };
        request.body = body;
        request.headers = { 'bdcfos-producer-tenantid': 'TENANT123' };
        dataSubscriptionFindOneMock.mockResolvedValueOnce({ id: 'aa5c6521-62fe-462d-9df4-66a668481526' } as any);
        await target.createDataSubscription(request, mockedExpressResponse);

        expect(connectDatabaseMock).toHaveBeenCalledTimes(1);
        expect(dataSubscriptionFindOneMock).toHaveBeenCalledTimes(1);
        expect(expressResponseMock.statusCalledTimes).toBe(1);
        expect(expressResponseMock.statusLastValue).toBe(StatusCodes.CONFLICT);
    });

    test('fail - internal server error', async () => {
        const request = {} as express.Request;
        const body = {
            subscriber: '/us-west-2/prism/Account123', producer: '/us-west-2/ariba/TENANT123', dataSourceId: 'JobPosting', schedule: '0 8 * * *',
            beginWatermark: '2023-02-01T18:49:01.211Z', destinationPath: 'store/fieldglass/us-west-2/tenant123'
        };
        request.body = body;
        request.headers = { 'bdcfos-producer-tenantid': 'TENANT123' };
        loadModelsMock.mockReset();
        loadModelsMock.mockImplementationOnce(() => { throw new Error('some-error') });
        await target.createDataSubscription(request, mockedExpressResponse);

        expect(connectDatabaseMock).toHaveBeenCalledTimes(1);
        expect(loadModelsMock).toHaveBeenCalledTimes(1);
        expect(expressResponseMock.statusCalledTimes).toBe(1);
        expect(expressResponseMock.statusLastValue).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    });

    test('fail - unauthorized', async () => {
        const request = {} as express.Request;
        const body = {
            subscriber: '/us-west-2/prism/Account123', producer: '/us-west-2/ariba/TENANT123', dataSourceId: 'JobPosting', schedule: '0 8 * * *',
            beginWatermark: '2023-02-01T18:49:01.211Z', destinationPath: 'store/fieldglass/us-west-2/tenant123'
        };
        request.body = body;
        request.headers = { 'bdcfos-producer-tenantid': 'TENANT_OTHER' };
        await target.createDataSubscription(request, mockedExpressResponse);

        expect(connectDatabaseMock).toHaveBeenCalledTimes(1);
        expect(expressResponseMock.statusCalledTimes).toBe(1);
        expect(expressResponseMock.statusLastValue).toBe(StatusCodes.UNAUTHORIZED);
    });
});

describe('Test get Data subscription', () => {
    test('fail - internal server error', async () => {
        connectDatabaseMock.mockRejectedValueOnce(new Error('some-error'));

        const request = {} as express.Request;
        request.params = { id: 'some-id' };
        request.headers = { 'bdcfos-producer-tenantid': 'TENANT123' };
        await target.getDataSubscription(request, mockedExpressResponse);

        expect(connectDatabaseMock).toHaveBeenCalledTimes(1);
        expect(expressResponseMock.statusCalledTimes).toBe(1);
        expect(expressResponseMock.statusLastValue).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    });

    test('fail - subscription not found', async () => {
        connectDatabaseMock.mockResolvedValueOnce(undefined);
        dataSubscriptionFindByPkMock.mockResolvedValueOnce(null);
        const request = {} as express.Request;
        request.params = { id: 'some-id' };
        request.headers = { 'bdcfos-producer-tenantid': 'TENANT123' };
        await target.getDataSubscription(request, mockedExpressResponse);

        expect(connectDatabaseMock).toHaveBeenCalledTimes(1);
        expect(dataSubscriptionFindByPkMock).toHaveBeenCalledTimes(1);
        expect(expressResponseMock.statusCalledTimes).toBe(1);
        expect(expressResponseMock.statusLastValue).toBe(StatusCodes.NOT_FOUND);
    });

    test('fail - no headers', async () => {
        const request = {} as express.Request;
        request.params = { id: 'some-id' };
        await target.getDataSubscription(request, mockedExpressResponse);

        expect(expressResponseMock.statusCalledTimes).toBe(1);
        expect(expressResponseMock.statusLastValue).toBe(StatusCodes.BAD_REQUEST);
    });

    test('fail - unauthorized', async () => {
        connectDatabaseMock.mockResolvedValueOnce(undefined);
        dataSubscriptionFindByPkMock.mockResolvedValueOnce({ id: 'some-id', producer: '/us-west-2/ariba/TENANT123', version: 1 } as any);
        const request = {} as express.Request;
        request.params = { id: 'some-id' };
        request.headers = { 'bdcfos-producer-tenantid': 'TENANT_OTHER' };
        await target.getDataSubscription(request, mockedExpressResponse);

        expect(connectDatabaseMock).toHaveBeenCalledTimes(1);
        expect(dataSubscriptionFindByPkMock).toHaveBeenCalledTimes(1);
        expect(expressResponseMock.statusCalledTimes).toBe(1);
        expect(expressResponseMock.statusLastValue).toBe(StatusCodes.UNAUTHORIZED);
    });

    test('success - subscription found', async () => {
        connectDatabaseMock.mockResolvedValueOnce(undefined);
        dataSubscriptionFindByPkMock.mockResolvedValueOnce({ id: 'some-id', producer: '/us-west-2/ariba/TENANT123', version: 1 } as any);
        const request = {} as express.Request;
        request.params = { id: 'some-id' };
        request.headers = { 'bdcfos-producer-tenantid': 'TENANT123' };
        await target.getDataSubscription(request, mockedExpressResponse);

        expect(connectDatabaseMock).toHaveBeenCalledTimes(1);
        expect(dataSubscriptionFindByPkMock).toHaveBeenCalledTimes(1);
        expect(expressResponseMock.statusCalledTimes).toBe(1);
        expect(expressResponseMock.statusLastValue).toBe(StatusCodes.OK);
    });
});

describe('Test Update Data subscription', () => {
    test('fail - no if-match header', async () => {
        const request = {} as express.Request;
        await target.updateDataSubscription(request, mockedExpressResponse);
        expect(expressResponseMock.statusCalledTimes).toBe(1);
        expect(expressResponseMock.statusLastValue).toBe(StatusCodes.PRECONDITION_REQUIRED);
    });

    test('fail - error on validation', async () => {
        const request = {} as express.Request;
        request.headers = {
            'if-match': '1',
            'bdcfos-producer-tenantid': 'TENANT123'
        };
        validateInputMock.mockImplementationOnce(() => { throw new Error(); });
        await target.updateDataSubscription(request, mockedExpressResponse);
        expect(expressResponseMock.statusCalledTimes).toBe(1);
        expect(expressResponseMock.statusLastValue).toBe(StatusCodes.BAD_REQUEST);
    });

    test('fail - subscription not found', async () => {
        connectDatabaseMock.mockResolvedValueOnce(undefined);
        dataSubscriptionFindByPkMock.mockResolvedValueOnce(null);
        const request = {} as express.Request;
        request.headers = {
            'if-match': '1',
            'bdcfos-producer-tenantid': 'TENANT123'
        };
        request.body = { schedule: 'some-schedule', upperWatermark: '2023-02-01T18:49:01.211Z' } as any;
        await target.updateDataSubscription(request, mockedExpressResponse);

        expect(connectDatabaseMock).toHaveBeenCalledTimes(1);
        expect(dataSubscriptionFindByPkMock).toHaveBeenCalledTimes(1);
        expect(expressResponseMock.statusCalledTimes).toBe(1);
        expect(expressResponseMock.statusLastValue).toBe(StatusCodes.NOT_FOUND);
    });

    test('fail - internal server error', async () => {
        connectDatabaseMock.mockRejectedValueOnce(new Error('some-error'));
        const request = {} as express.Request;
        request.headers = {
            'if-match': '1',
            'bdcfos-producer-tenantid': 'TENANT123'
        };
        request.body = { schedule: 'some-schedule', upperWatermark: '2023-02-01T18:49:01.211Z' } as any;
        await target.updateDataSubscription(request, mockedExpressResponse);

        expect(connectDatabaseMock).toHaveBeenCalledTimes(1);
        expect(expressResponseMock.statusCalledTimes).toBe(1);
        expect(expressResponseMock.statusLastValue).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    });

    test('fail - unauthorized', async () => {
        connectDatabaseMock.mockResolvedValueOnce(undefined);
        dataSubscriptionFindByPkMock.mockResolvedValueOnce({
            id: '123',
            producer: '/us-west-2/ariba/TENANT123'
        } as any);
        const request = {} as express.Request;
        request.headers = {
            'if-match': '1',
            'bdcfos-producer-tenantid': 'TENANT_OTHER'
        };
        request.body = { schedule: 'some-schedule', upperWatermark: '2023-02-01T18:49:01.211Z' } as any;
        await target.updateDataSubscription(request, mockedExpressResponse);
        expect(dataSubscriptionFindByPkMock).toHaveBeenCalledTimes(1);
        expect(connectDatabaseMock).toHaveBeenCalledTimes(1);
        expect(expressResponseMock.statusCalledTimes).toBe(1);
        expect(expressResponseMock.statusLastValue).toBe(StatusCodes.UNAUTHORIZED);
    });

    test('success - subscription updated', async () => {
        connectDatabaseMock.mockResolvedValueOnce(undefined);
        const updateMock = jest.fn();
        dataSubscriptionFindByPkMock.mockResolvedValueOnce({
            id: '123',
            beginWatermark: new Date('2017-01-01T00:00:00.000Z'),
            schedule: '0 8 * * *',
            dataSourceId: 'hcm.JobPosting',
            subscriber: '/us30/prism/65b79ef5353741f797e17343a5384333',
            producer: '/us-west-2/ariba/TENANT123',
            upperWatermark: new Date('2017-01-01T00:00:00.000Z'),
            update: updateMock,
            dataValues: {}
        } as any);
        const request = {} as express.Request;
        request.headers = {
            'if-match': '1',
            'bdcfos-producer-tenantid': 'TENANT123'
        };
        request.body = { schedule: 'some-schedule', upperWatermark: '2023-02-01T18:49:01.211Z' } as any;
        await target.updateDataSubscription(request, mockedExpressResponse);
        expect(dataSubscriptionFindByPkMock).toHaveBeenCalledTimes(1);
        expect(connectDatabaseMock).toHaveBeenCalledTimes(1);
        expect(updateMock).toHaveBeenCalledTimes(1);
        expect(updateMock).toHaveBeenCalledWith({ schedule: 'some-schedule', upperWatermark: '2023-02-01T18:49:01.211Z' });

        expect(expressResponseMock.statusCalledTimes).toBe(1);
        expect(expressResponseMock.statusLastValue).toBe(StatusCodes.NO_CONTENT);
    });
});

describe('Test Delete Data subscription', () => {
    test('fail - internal server error', async () => {
        connectDatabaseMock.mockRejectedValueOnce(new Error('some-error'));

        const request = {} as express.Request;
        request.headers = { 'bdcfos-producer-tenantid': 'TENANT123' };
        request.params = { id: 'some-id' };
        await target.deleteDataSubscription(request, mockedExpressResponse);

        expect(connectDatabaseMock).toHaveBeenCalledTimes(1);
        expect(expressResponseMock.statusCalledTimes).toBe(1);
        expect(expressResponseMock.statusLastValue).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    });

    test('fail - subscription not found', async () => {
        connectDatabaseMock.mockResolvedValueOnce(undefined);
        dataSubscriptionFindByPkMock.mockResolvedValueOnce(null);
        const request = {} as express.Request;
        request.headers = { 'bdcfos-producer-tenantid': 'TENANT123' };
        request.params = { id: 'some-id' };
        await target.deleteDataSubscription(request, mockedExpressResponse);

        expect(connectDatabaseMock).toHaveBeenCalledTimes(1);
        expect(dataSubscriptionFindByPkMock).toHaveBeenCalledTimes(1);
        expect(expressResponseMock.statusCalledTimes).toBe(1);
        expect(expressResponseMock.statusLastValue).toBe(StatusCodes.NOT_FOUND);
    });

    test('fail - no headers', async () => {
        const request = {} as express.Request;
        request.params = { id: 'some-id' };
        await target.deleteDataSubscription(request, mockedExpressResponse);

        expect(expressResponseMock.statusCalledTimes).toBe(1);
        expect(expressResponseMock.statusLastValue).toBe(StatusCodes.BAD_REQUEST);
    });

    test('fail - unauthorized', async () => {
        connectDatabaseMock.mockResolvedValueOnce(undefined);
        dataSubscriptionFindByPkMock.mockResolvedValueOnce({
            producer: '/us-west-2/ariba/TENANT123'
        } as any);

        const request = {} as express.Request;
        request.headers = { 'bdcfos-producer-tenantid': 'TENANT_OTHER' };
        request.params = { id: 'some-id' };
        await target.deleteDataSubscription(request, mockedExpressResponse);

        expect(connectDatabaseMock).toHaveBeenCalledTimes(1);
        expect(dataSubscriptionFindByPkMock).toHaveBeenCalledTimes(1);
        expect(expressResponseMock.statusCalledTimes).toBe(1);
        expect(expressResponseMock.statusLastValue).toBe(StatusCodes.UNAUTHORIZED);
    });

    test('success - subscription found', async () => {
        connectDatabaseMock.mockResolvedValueOnce(undefined);
        const destroyMock = jest.fn();
        dataSubscriptionFindByPkMock.mockResolvedValueOnce({
            producer: '/us-west-2/ariba/TENANT123',
            destroy: destroyMock
        } as any);

        const request = {} as express.Request;
        request.headers = { 'bdcfos-producer-tenantid': 'TENANT123' };
        request.params = { id: 'some-id' };
        await target.deleteDataSubscription(request, mockedExpressResponse);

        expect(connectDatabaseMock).toHaveBeenCalledTimes(1);
        expect(dataSubscriptionFindByPkMock).toHaveBeenCalledTimes(1);
        expect(expressResponseMock.statusCalledTimes).toBe(1);
        expect(expressResponseMock.statusLastValue).toBe(StatusCodes.NO_CONTENT);
        expect(destroyMock).toHaveBeenCalledTimes(1);
    });
});

describe('Test get all Data subscriptions', () => {
    test('fail - internal server error', async () => {
        connectDatabaseMock.mockRejectedValueOnce(new Error('some-error'));

        const request = {} as express.Request;
        request.query = {
            producer: 'sap-source-val',
            subscriber: 'sap-subscriber-val'
        };
        request.headers = { 'bdcfos-producer-tenantid': 'TENANT123' };
        await target.getAllDataSubscriptions(request, mockedExpressResponse);

        expect(connectDatabaseMock).toHaveBeenCalledTimes(1);
        expect(expressResponseMock.statusCalledTimes).toBe(1);
        expect(expressResponseMock.statusLastValue).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    });

    test('fail - bad request - no headers', async () => {
        const request = {} as express.Request;
        request.headers = {};
        await target.getAllDataSubscriptions(request, mockedExpressResponse);

        expect(expressResponseMock.statusCalledTimes).toBe(1);
        expect(expressResponseMock.statusLastValue).toBe(StatusCodes.BAD_REQUEST);
    });

    test('fail - bad request - no subscriber param', async () => {
        const request = {} as express.Request;
        request.headers = { 'bdcfos-producer-tenantid': 'TENANT123' };
        await target.getAllDataSubscriptions(request, mockedExpressResponse);

        expect(expressResponseMock.statusCalledTimes).toBe(1);
        expect(expressResponseMock.statusLastValue).toBe(StatusCodes.BAD_REQUEST);
        expect(expressResponseMock.sendLastValue).toBe('Query parameter "subscriber" is required');
    });

    test('success - subscriptions found', async () => {
        const numberOfRecords = 3;
        connectDatabaseMock.mockResolvedValueOnce(undefined);
        // Push additional record for tenant1 to test number of calls to getResourceUrl
        dataSubscriptionFindAllMock.mockResolvedValueOnce([{ id: '4', producer: '/us-west-2/ariba/TENANT1' }, ...generateRecords(numberOfRecords, false)] as any); getResourceUrlMock.mockReturnValue('some-url');
        const request = {} as express.Request;
        request.query = {
            producer: '/us-west-2/ariba/TENANT1',
            subscriber: '/us-west-2/prism/Account123'
        };
        request.headers = { 'bdcfos-producer-tenantid': 'TENANT1' };
        await target.getAllDataSubscriptions(request, mockedExpressResponse);

        expect(connectDatabaseMock).toHaveBeenCalledTimes(1);
        expect(dataSubscriptionFindAllMock).toHaveBeenCalledTimes(1);
        expect(getResourceUrlMock).toHaveBeenCalledTimes(2);
        expect(expressResponseMock.statusCalledTimes).toBe(1);
        expect(expressResponseMock.statusLastValue).toBe(StatusCodes.OK);
        expect(expressResponseMock.jsonLastValue).toMatchObject(
            {
                next: null
            }
        );
    });

    test('success - subscription found - 50 records to test next', async () => {
        const numberOfRecords = 50;
        connectDatabaseMock.mockResolvedValueOnce(undefined);
        dataSubscriptionFindAllMock.mockResolvedValueOnce(generateRecords(numberOfRecords, true) as any);
        getResourceUrlMock.mockReturnValue('some-url');
        const request = {
            headers: { host: 'some.url.sap', 'bdcfos-producer-tenantid': 'TENANT1' },
            path: '/dsapi/dss/v0/dataSubscriptions',
            query: {
                producer: '/us-west-2/ariba/TENANT1',
                subscriber: 'sap-subscriber-val',
                skip: 0,
                top: 50
            },
            protocol: 'https',
        } as unknown as express.Request;
        request.query = {
            producer: 'sap-source-val',
            subscriber: 'sap-subscriber-val'
        };
        await target.getAllDataSubscriptions(request, mockedExpressResponse);

        expect(connectDatabaseMock).toHaveBeenCalledTimes(1);
        expect(dataSubscriptionFindAllMock).toHaveBeenCalledTimes(1);
        expect(getResourceUrlMock).toHaveBeenCalledTimes(50);
        expect(expressResponseMock.statusCalledTimes).toBe(1);
        expect(expressResponseMock.statusLastValue).toBe(StatusCodes.OK);
        expect(expressResponseMock.jsonLastValue).toMatchObject(
            {
                next: 'https://some.url.sap/dsapi/dss/v0/dataSubscriptions?producer=sap-source-val&subscriber=sap-subscriber-val&skip=50&top=50'
            }
        );
    });
});
