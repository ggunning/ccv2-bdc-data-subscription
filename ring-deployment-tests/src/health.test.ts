import axios from 'axios';

const { API_URL } = process.env;
jest.setTimeout(60000);

describe('GET /probes/health', () => {
    test('Success - should return UP status', async () => {
        await expect(axios.get(`${API_URL}/probes/health`)).resolves.toMatchObject({
            status: 200,
            data: {
                status: 'UP',
                serviceInfo: {
                    name: expect.any(String),
                    version: expect.any(String)
                },
                components: {
                    db: {
                        status: 'UP',
                        database: 'postgres'
                    }
                }
            }
        });
    });
});

describe('GET /probes/health/liveness', () => {
    test('Success - should return UP status', async () => {
        await expect(axios.get(`${API_URL}/probes/health/liveness`)).resolves.toMatchObject({
            status: 200,
            data: {
                status: 'UP'
            }
        });
    });
});

describe('GET /probes/health/readiness', () => {
    test('Success - should return UP status', async () => {
        await expect(axios.get(`${API_URL}/probes/health/readiness`)).resolves.toMatchObject({
            status: 200,
            data: {
                status: 'UP'
            }
        });
    });
});
