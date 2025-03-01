# Unit test coverage report
How to setup UT coverage reports for sonar.

## How it works
1. New commit to master / PR triggers Jenkins job
2. Jenkins job triggers XMake job
3. XMake job executes Dockerfile
4. XMake extracts test reports from docker image to the XMake workspace & archived artifacts
5. Jenkins build downloads test reports from the XMake workspace
6. Jenkins build passes results to static code checks

## How to set it up
1. Run your unit tests as part of the Dockerfile [example](https://github.tools.sap/bdc-fos/fos-data-subscription-svc/blob/1f3afa2a947fe1c95b3ff1e487e2dc9c5fdd60de/Dockerfile#L23) 
2. Reports have to be part of the coverage folder [example](https://github.tools.sap/bdc-fos/fos-data-subscription-svc/blob/1f3afa2a947fe1c95b3ff1e487e2dc9c5fdd60de/app/jest.json#L36)  
required files: `lcov.info`, `TEST-*.xml`, `cobertura-coverage.xml`
3. Coverage folder have to be part of the final image stage [example](https://github.tools.sap/bdc-fos/fos-data-subscription-svc/blob/1f3afa2a947fe1c95b3ff1e487e2dc9c5fdd60de/Dockerfile#L55)
4. Create DockerCommands file (must be named with capital D and C) [example](https://github.tools.sap/bdc-fos/fos-data-subscription-svc/blob/1f3afa2a947fe1c95b3ff1e487e2dc9c5fdd60de/DockerCommands)
5. Define which files should be extracted from the image (every file has to be listed by path), use EXTRACT command [example](https://github.tools.sap/bdc-fos/fos-data-subscription-svc/blob/1f3afa2a947fe1c95b3ff1e487e2dc9c5fdd60de/DockerCommands#L1)  
in our service the path to coverage folder is `/app/coverage/`
6. Enable post-build static code checks in your Jenkins pipeline by setting env variable in your Jenkinsfile `ENABLE_POST_BUILD_STATIC_CODE_CHECKS: true`  [example](https://github.tools.sap/bdc-fos/fos-data-subscription-svc/blob/1f3afa2a947fe1c95b3ff1e487e2dc9c5fdd60de/Jenkinsfile#L22)  
(this is temporary until all nodejs services start to use this solution - env var will be removed)
