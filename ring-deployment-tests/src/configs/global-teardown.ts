import { reportResults } from './report-results';

module.exports = async function (globalConfig: any, projectConfig: any) {
    console.log(globalConfig.testPathPattern);
    console.log(projectConfig.cache);
    console.log('Running global teardown');
    await reportResults();
};
