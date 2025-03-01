import { logger } from '@bdc-fos/fos-logger';
import axios, { AxiosInstance, Method } from 'axios';
import { Agent } from 'https';
import { randomUUID } from 'node:crypto';
import { Config, getConfig } from './configs/env-config';
import { readCredential } from './utils';

interface DataSubscription {
    id?: string;
    subscriber: string;
    producer: string;
    dataSourceId: string;
    schedule: string;
    beginWatermark: Date;
    upperWatermark: Date;
    destinationPath: string;
    createdAt?: Date;
    updatedAt?: Date;
};

interface DSListDTO {
    'dataSubscriptions': Array<{
        id: string,
        _links: {
            self: string
        }
    }>
};

const testId = randomUUID();
const {
    SERVICE_URL
} = process.env;
const subscriber = `/eu-12/prism-qa/account${testId}`;
const producer = `/us-west-2/fieldglass/tnt${testId}`;
const createdSubscriptions: string[] = [];
const ERR_400_VALIDATION = {
    status: 400,
    data: expect.stringMatching(/Validation.*failed/)
};

jest.setTimeout(60000);

let conf: Config;
let dssAxiosClient: AxiosInstance;

beforeAll(async () => {
    conf = await getConfig();
    const response = await axios.get(`${conf.tenantServiceUrl}/internal/runtime/v1/tenants/${conf.tenantId}`);
    dssAxiosClient = axios.create({
        httpsAgent: new Agent({
            cert: response?.data?.dsapiClientCert,
            key: await readCredential(response?.data?.dsapiClientKeyId) }),
        headers: {
            'bdcfos-producer-tenantid': conf.producerTenantId
        }
    });
});

describe('Invalid requests', () => {
    // map of valid methods for paths, DUMMY method is not here because it returns 400 bad request
    // eslint-disable-next-line @typescript-eslint/array-type -- disabled
    const apis: { path: string, methods: Method[], excludedMethods: Method[] }[] = [{
        path: '/v0/dataSubscriptions',
        methods: ['POST', 'GET'],
        excludedMethods: ['PUT', 'DELETE', 'PATCH', 'OPTIONS']
    }, {
        path: '/v0/dataSubscriptions/123',
        methods: ['GET', 'PATCH', 'DELETE'],
        excludedMethods: ['POST', 'PUT', 'OPTIONS']
    }];

    describe.each(apis)('Testing API $path', ({ path, methods, excludedMethods }) => {
        test.each(excludedMethods)(`Fail - API %s ${path} should return 404 - not found`, async (method: Method) => {
            const api = apis.find(obj => obj.path === path);
            if (api.methods.includes(method)) {
                return;
            }
            await expect(dssAxiosClient.request({ method, url: `${SERVICE_URL}${path}` }))
                .rejects.toMatchObject({ response: { status: 404 } });
        });

        // try DUMMY
        test(`Fail - API ${path} should return 400 - bad request (invalid method used)`, async () => {
            await expect(dssAxiosClient.request({
                method: 'DUMMY',
                url: `${SERVICE_URL}${path}`,
                params: { subscriber }
            }))
                .rejects.toMatchObject({ response: { status: 400 } });
        });

        test.each(methods)(`Fail - API %s ${path} should return 401 - unauthorized (invalid cert)`, async (method: Method) => {
            // Producer cert/key is not valid for DSS
            const axiosIncorrectCert = axios.create({ httpsAgent: new Agent({ cert: conf.producerCert, key: conf.producerKey }) });
            await expect(axiosIncorrectCert.request({
                method,
                url: `${SERVICE_URL}${path}`,
                params: { subscriber }
            }))
                .rejects.toMatchObject({ response: { status: 401 } });
        });

        test.each(methods)(`Fail - API %s ${path} should return ERR_OSSL_PEM_NO_START_LINE - no PEM format`, async (method: Method) => {
            const axiosNoPEM = axios.create({ httpsAgent: new Agent({ cert: 'NoPEM', key: 'NoPEM' }) });
            await expect(axiosNoPEM.request({ method, url: `${SERVICE_URL}${path}`, params: { subscriber } }))
                .rejects.toMatchObject({
                    code: 'ERR_OSSL_PEM_NO_START_LINE'
                });
        });

        test.each(methods)(`Fail - API %s ${path} should return ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED - missing certificate`, async (method: Method) => {
            const axiosMissingCert = axios.create({ httpsAgent: new Agent({}) });
            await expect(axiosMissingCert.request({ method, url: `${SERVICE_URL}${path}` }))
                .rejects.toMatchObject({
                    code: 'ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED'
                });
        });
    });
});

describe('Valid requests', () => {
    const dataSubscription: Partial<DataSubscription> = {
        subscriber,
        producer,
        dataSourceId: 'JobPosting',
        schedule: '***6*',
        destinationPath: 'https://mock-url.com/us-west-2/fieldglass/tenant123'
    };
    const baseUrl = `${SERVICE_URL}/v0/dataSubscriptions`;

    describe('GET /v0/dataSubscriptions', () => {
        test('Success - should return list of subscriptions', async () => {
            await expect(dssAxiosClient.get<DSListDTO>(baseUrl, { params: { subscriber } })).resolves.toMatchObject({
                status: 200,
                data: {
                    'dataSubscriptions': expect.any(Array)
                }
            });
        });
    });

    describe('POST /v0/dataSubscriptions', () => {
        test('Success - should create new scheduled subscription', async () => {
            const dataSubscriptionLocal: Partial<DataSubscription> = {
                ...dataSubscription,
                producer: `${producer}-1`,
                destinationPath: '/'
            };

            const prom = dssAxiosClient.post(baseUrl, dataSubscriptionLocal);
            await expect(prom)
                .resolves.toMatchObject({
                    status: 201,
                    data: expect.stringMatching(/[a-z0-9-]+/)
                });
            const { data: id } = await prom;
            createdSubscriptions.push(id);

            await expect(dssAxiosClient.get(`${baseUrl}/${id}`))
                .resolves.toMatchObject({
                    status: 200,
                    data: {
                        ...dataSubscriptionLocal,
                        id,
                        upperWatermark: '1970-01-01T00:00:00.000Z',
                        active: true
                    }
                });
        });

        test('Success - 2 newly created subscriptions should show up in subscriptions list', async () => {
            // get before count
            const listProm = dssAxiosClient.get<DSListDTO>(baseUrl, { params: { subscriber } });
            await expect(listProm).resolves.toMatchObject({ status: 200, data: { 'dataSubscriptions': expect.any(Array) } });
            const { data: { dataSubscriptions: entities } } = await listProm;

            const prom = dssAxiosClient.post(baseUrl, {
                ...dataSubscription,
                dataSourceId: 'JobPosting2'
            });
            await expect(prom).resolves.toMatchObject({
                status: 201,
                data: expect.stringMatching(/[a-z0-9-]+/)
            });
            // created object must match
            const { data: id } = await prom;
            createdSubscriptions.push(id);
            // create another subscription
            const prom2 = dssAxiosClient.post(baseUrl, { ...dataSubscription, dataSourceId: 'JobPosting3' });
            await expect(prom2).resolves.toMatchObject({ data: expect.any(String) });
            const { data: id2 } = await prom2;
            createdSubscriptions.push(id2);
            // test if matches
            await expect(dssAxiosClient.get(`${baseUrl}/${id2}`)).resolves.toMatchObject({
                status: 200,
                data: {
                    id: id2,
                    ...dataSubscription,
                    dataSourceId: 'JobPosting3',
                    upperWatermark: '1970-01-01T00:00:00.000Z'
                }
            });
            // there should be two more items
            await expect(dssAxiosClient.get<DSListDTO>(baseUrl, { params: { subscriber } }))
                .resolves.toMatchObject({
                    status: 200,
                    data: {
                        'dataSubscriptions': expect.arrayContaining([
                            ...entities, {
                                id,
                                _links: expect.any(Object)
                            },
                            {
                                id: id2,
                                _links: expect.any(Object)
                            }
                        ])
                    }
                });

            await expect(dssAxiosClient.get<DSListDTO>(baseUrl, { params: { 'subscriber': `some-random-${Math.random()}` } }))
                .resolves.toMatchObject({
                    status: 200,
                    data: {
                        'dataSubscriptions': []
                        //next: expect.stringMatching('https://.*')
                    }
                });
        });

        test('Success - should create, delete and then again create the same scheduled subscription', async () => {
            const dataSubscriptionLocal: Partial<DataSubscription> = {
                ...dataSubscription,
                producer: `${producer}-5`
            };

            const prom1 = dssAxiosClient.post(baseUrl, dataSubscriptionLocal);
            await expect(prom1)
                .resolves.toMatchObject({
                    status: 201,
                    data: expect.stringMatching(/[a-z0-9-]+/)
                });
            const { data: id1 } = await prom1;

            await expect(dssAxiosClient.delete(`${baseUrl}/${id1}`))
                .resolves.toMatchObject({ status: 204 });

            const prom2 = dssAxiosClient.post(baseUrl, dataSubscriptionLocal);
            await expect(prom2)
                .resolves.toMatchObject({
                    status: 201,
                    data: expect.stringMatching(/[a-z0-9-]+/)
                });
            const { data: id2 } = await prom2;
            createdSubscriptions.push(id2);
        });

        test('Fail - schema validation fails as empty object in request payload is invalid', async () => {
            await expect(dssAxiosClient.post(baseUrl, {}))
                .rejects.toMatchObject({ response: ERR_400_VALIDATION });
        });

        test('Fail - creating duplicates of scheduled subscription is disallowed', async () => {
            const dataSubscriptionLocal: Partial<DataSubscription> = {
                ...dataSubscription,
                producer: `${producer}-3`
            };

            const prom = dssAxiosClient.post(baseUrl, dataSubscriptionLocal);
            await expect(prom)
                .resolves.toMatchObject({
                    status: 201,
                    data: expect.stringMatching(/[a-z0-9-]+/)
                });
            const { data: id } = await prom;
            createdSubscriptions.push(id);

            await expect(dssAxiosClient.post(baseUrl, dataSubscriptionLocal))
                .rejects.toMatchObject({ response: { status: 409 } });
        });
    });

    describe('PATCH /v0/dataSubscriptions', () => {
        test('Success - patch subscription active to false', async () => {
            const id = createdSubscriptions[0];
            let res = await dssAxiosClient.get(`${baseUrl}/${id}`);
            expect(res.status).toBe(200);
            expect(res.data.active).toBe(true); // default value

            const version = res.data.version;
            const eTag = res.headers.etag;
            expect(version.toString()).toEqual(eTag);
            const patchReq = dssAxiosClient.patch(`${baseUrl}/${id}`, { 'active': false }, { headers: { 'if-match': eTag } });
            await expect(patchReq).resolves.toMatchObject({ status: 204 });
            res = await dssAxiosClient.get(`${baseUrl}/${id}`);
            expect(res).toMatchObject({
                status: 200,
                data: {
                    id,
                    ...dataSubscription,
                    destinationPath: '/',
                    producer: `${producer}-1`,
                    version: version + 1,
                    active: false // here we should see the change
                }
            });
        });

        test('Success - patch subscription active to true', async () => {
            const id = createdSubscriptions[0];
            let res = await dssAxiosClient.get(`${baseUrl}/${id}`);
            expect(res.status).toBe(200);
            expect(res.data.active).toBe(false); // default value
            const version = res.data.version;
            const eTag = res.headers.etag;
            expect(version.toString()).toEqual(eTag);
            const patchReq = dssAxiosClient.patch(`${baseUrl}/${id}`, { 'active': true }, { headers: { 'if-match': eTag } });
            await expect(patchReq).resolves.toMatchObject({ status: 204 });
            res = await dssAxiosClient.get(`${baseUrl}/${id}`);
            expect(res).toMatchObject({
                status: 200,
                data: {
                    id,
                    ...dataSubscription,
                    destinationPath: '/',
                    producer: `${producer}-1`,
                    version: version + 1,
                    active: true // here we should see the change
                }
            });
        });

        test('Fail - patch subscription with wrong version', async () => {
            const patchReq = dssAxiosClient.patch(`${baseUrl}/${createdSubscriptions[0]}`, { 'active': false }, { headers: { 'if-match': -1 } });
            await expect(patchReq).rejects.toMatchObject({
                status: 412
            });
        });

        test('Fail - patch subscription with wrong patch property name', async () => {
            // take first created subscription
            const id = createdSubscriptions[0];

            const res = await dssAxiosClient.get(`${baseUrl}/${id}`);
            expect(res.status).toBe(200);

            // lets test with wrong if-match (etag/version)
            const version = res.data.version;
            const eTag = res.headers.etag;
            expect(version.toString()).toEqual(eTag);
            const patchReq = dssAxiosClient.patch(`${baseUrl}/${id}`, { ' BadPropertyName': false }, { headers: { 'if-match': eTag } });
            await expect(patchReq).rejects.toMatchObject({
                status: 400
            });
        });

        // dataSourceId
        // valid property name but not allowed in patch schema

        test('Success - patch subscription allowed values', async () => {
            // take first created subscription
            const id = createdSubscriptions[0];

            let res = await dssAxiosClient.get(`${baseUrl}/${id}`);
            expect(res.status).toBe(200);
            const version = res.data.version;
            const eTag = res.headers.etag;
            expect(version.toString()).toEqual(eTag);
            const patchValues = {
                active: false,
                upperWatermark: '1970-01-01T01:00:00.000Z',
                schedule: '***4*'
            };
            const patchReq = dssAxiosClient.patch(`${baseUrl}/${id}`, patchValues, { headers: { 'if-match': eTag } });
            await expect(patchReq).resolves.toMatchObject({ status: 204 });
            res = await dssAxiosClient.get(`${baseUrl}/${id}`);
            expect(res).toMatchObject({
                status: 200,
                data: {
                    id,
                    ...dataSubscription,
                    destinationPath: '/',
                    producer: `${producer}-1`,
                    version: version + 1,
                    schedule: '***4*',
                    upperWatermark: '1970-01-01T01:00:00.000Z',
                    active: false // here we should see the change
                }
            });
        });
    });

    describe('DELETE /v0/dataSubscriptions', () => {
        test('Success - should delete subscription by id', async () => {
            for (const id of createdSubscriptions) {
                logger.info('Deleting subscription id:', id);
                await expect(dssAxiosClient.delete(`${baseUrl}/${id}`, { params: { producer } }))
                    .resolves.toMatchObject({ status: 204 });
            }

            // catch runaway ids
            await expect(dssAxiosClient.get(baseUrl, { params: { subscriber } })).resolves.toMatchObject({
                status: 200,
                data: expect.arrayContaining([])
            });
        });
    });

    // make sure all subscriptions are removed
    afterAll(async () => {
        const { data: { dataSubscriptions } } = await dssAxiosClient.get<DSListDTO>(baseUrl, { params: { subscriber } });
        await Promise.all(dataSubscriptions.map(async ({ id }: { id: string }) => await dssAxiosClient.delete(`${baseUrl}/${id}`)))
            .catch((err: unknown) => console.warn(err));
    });
});
