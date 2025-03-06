# We use node20 as sap npm packages are not available in node22 currently
ARG BASE_IMAGE_TAG=20-alpine@sha256:c13b26e7e602ef2f1074aef304ce6e9b7dd284c419b35d89fcf3cc8e44a8def9
ARG PROD_BASE_IMAGE_TAG=1.0.11@sha256:6bf81e0eb247e6769875822e0f2228af50f6fe7c47ba6d49d27535613f9f3c18

############################
# Stage: Dev Build
############################
FROM public.int.repositories.cloud.sap/node:${BASE_IMAGE_TAG} AS build
LABEL version='1.0.0'

WORKDIR /app

ARG CREDS_NPM_TOKEN

COPY ./app/package*.json .
COPY ./app/.npmrc .
COPY ./app/*.tgz .

RUN npm ci

COPY ./app .

RUN npm run build
#RUN npm run test

############################
# Stage: Preproduction Build
# purpose of this stage is to build without dev dependencies
# another stage is required to properly discard logged CREDS_NPM_TOKEN used in this stage
############################

FROM public.int.repositories.cloud.sap/node:${BASE_IMAGE_TAG} AS preproduction
LABEL version='1.0.0'

WORKDIR /app

COPY ./app/package*.json .
COPY ./app/.npmrc .
COPY ./app/*.tgz .

ARG CREDS_NPM_TOKEN

RUN npm ci --omit=dev --unsafe-perm=true

COPY --from=build ./app/bin ./bin

############################
# Stage: Production Build
############################

FROM bdc-fos-docker-jenkins.int.repositories.cloud.sap/nodejs20-debian12:${PROD_BASE_IMAGE_TAG} AS production
LABEL version='1.0.0'

WORKDIR /app

## Needed for sonar scans
COPY --from=build ./app/coverage ./coverage

COPY --from=preproduction ./app .
COPY ./app/resources ./resources

ARG PORT=80
ENV PORT=$PORT
EXPOSE $PORT

# Command below can be used in distroless image as well
CMD ["bin/start.js"]
