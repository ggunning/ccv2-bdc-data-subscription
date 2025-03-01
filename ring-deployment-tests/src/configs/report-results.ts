import { convertToSafeError, logger } from '@bdc-fos/fos-logger';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import { SlackNotificationPolicy, TestResultProcessorClient } from './test-result-processor-client';

const filePath = '/tmp/test-results.json';
const {
    TEST_RESULT_SLACK_CHANNEL_ID,
    SERVICE_NAME,
    TEAM_NAME,
    IS_RING_DEPLOYMENT_RELATED
} = process.env;

const getTraceparent = (): string => {
    const traceId = randomBytes(16).toString('hex');
    const spanId = randomBytes(8).toString('hex');
    const traceFlags = '01'; // Commonly used value, indicating the sampled flag is set
    return `00-${traceId}-${spanId}-${traceFlags}`;
};

export const reportResults = async (): Promise<void> => {
    try {
        const testResultsData = fs.readFileSync(filePath, 'utf8');
        const testResults: any = JSON.parse(testResultsData);

        const testResultProcessorClient = TestResultProcessorClient.getClient();
        await testResultProcessorClient.initiateSession(
            `${SERVICE_NAME}-project`,
            TEAM_NAME,
            [SERVICE_NAME],
            IS_RING_DEPLOYMENT_RELATED === 'true',
            { [TEAM_NAME]: TEST_RESULT_SLACK_CHANNEL_ID },
            SlackNotificationPolicy.StatusChangeAndFailures,
            60
        );
        try {
            for (const testFileResult of testResults.testResults) {
                for (const oneTestResult of testFileResult.testResults) {
                    const testName = oneTestResult.fullName.replaceAll('/', '|');
                    await testResultProcessorClient.registerTest(
                        testName, [TEAM_NAME], [SERVICE_NAME], new Date(Date.now()).toISOString(), getTraceparent(), false, null);
                    const result = oneTestResult.status !== 'failed';
                    await testResultProcessorClient.finishTest(testName, new Date(Date.now() + oneTestResult.duration).toISOString(), result, false, null);
                }
            }
        } catch (error) {
            logger.error('Error during test reporting', convertToSafeError(error));
        } finally {
            await testResultProcessorClient.closeSession();
        }
    } catch (error) {
        logger.error('Failed to report test results', convertToSafeError(error));
    }
};
