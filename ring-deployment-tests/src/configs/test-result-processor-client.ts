import axios, { AxiosInstance } from 'axios';

const { TEST_RESULT_PROCESSOR_URL } = process.env;

export enum SlackNotificationPolicy {
    None = 'none',
    All = 'all',
    AllFailures = 'allFailures',
    StatusChange = 'statusChange',
    StatusChangeAndFailures = 'statusChangeAndFailures'
}

export class TestResultProcessorClient {
    static client: TestResultProcessorClient;
    static currentTestName: string;

    private baseUrl: string;
    private axiosInstance: AxiosInstance;
    sessionId: string | null = null;

    constructor(baseUrl: string = 'http://localhost:8080') {
        this.baseUrl = baseUrl;
        this.axiosInstance = axios.create({
            baseURL: this.baseUrl,
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    static getClient(): TestResultProcessorClient {
        if (!TestResultProcessorClient.client) {
            TestResultProcessorClient.client = new TestResultProcessorClient(TEST_RESULT_PROCESSOR_URL);
        }
        return TestResultProcessorClient.client;
    }

    private async makeRequest(
        method: string,
        endpoint: string,
        data?: any
    ): Promise<any> {
        try {
            const response = await this.axiosInstance.request({
                method,
                url: endpoint,
                data
            });
            return response.data;
        } catch (error) {
            if (error?.response?.data) {
                console.error(`Request ${JSON.stringify({
                    method,
                    url: endpoint,
                    data
                })} failed: ${error.message}. Response: ${JSON.stringify(error.response.data)}`);
            }
            if (error?.message) {
                console.error(`Request failed: ${error.message}`);
            }
        }
    }

    async initiateSession(
        serviceName: string,
        ownerTeamName: string,
        servicesOwned: string[],
        isRingDeploymentRelated: boolean,
        slackChannels: Record<string, string>,
        slackNotificationPolicy: string,
        ttlInMinutes: number | null
    ): Promise<string> {
        const payload = {
            testsRunnerName: serviceName,
            teamName: ownerTeamName,
            servicesOwned,
            isForRingDeployment: isRingDeploymentRelated,
            slackChannels,
            slackNotificationPolicy,
            ttlInMinutes
        };
        const response = await this.makeRequest(
            'POST',
            '/internal/api/v1/sessions',
            payload
        );

        if (response && typeof response === 'object' && 'sessionId' in response) {
            this.sessionId = response.sessionId;
            if (this.sessionId === null) {
                throw new Error('Received null sessionId from server');
            }

            return this.sessionId;
        }
        throw new Error('Failed to initiate session');
    }

    async registerTest(
        testName: string,
        teamNames: string[],
        serviceNames: string[],
        startTime: string,
        traceparent: string,
        hasTestSkipped: boolean,
        tagsAndLabels: Array<{ key: string; value: string }> | null
    ): Promise<void> {
        if (!this.sessionId) {
            throw new Error('Session not initiated');
        }
        const payload = {
            testName,
            teamNames,
            serviceNames,
            startTime,
            traceparent,
            skipped: hasTestSkipped,
            tagsAndLabels
        };
        await this.makeRequest(
            'POST',
            `/internal/api/v1/sessions/${this.sessionId}/tests`,
            payload
        );
    }

    async finishTest(
        testName: string,
        endTime: string,
        hasTestSucceeded: boolean,
        hasTestExceptioned: boolean,
        additionalInfo: any
    ): Promise<void> {
        if (!this.sessionId) {
            throw new Error('Session not initiated');
        }
        const payload = {
            endTime,
            passed: hasTestSucceeded,
            exceptioned: hasTestExceptioned,
            additionalInfo
        };
        await this.makeRequest(
            'PATCH',
            `/internal/api/v1/sessions/${this.sessionId}/tests/${testName}`,
            payload
        );
    }

    async closeSession(): Promise<void> {
        if (!this.sessionId) {
            throw new Error('Session not initiated');
        }
        await this.makeRequest('DELETE', `/internal/api/v1/sessions/${this.sessionId}`);
        this.sessionId = null;
    }

    isConnected() {
        return !!this.sessionId;
    }
}
