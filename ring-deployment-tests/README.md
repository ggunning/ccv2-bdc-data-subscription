# Ring Deployment Tests

## How to Run Locally  

1. Install and Build
```shell
$ cd ring-deployment-tests
$ npm install && npm run build
```
2. Run tests against service in `eu10-poc`:
```shell

export SERVICE_URL=api.mtls.dev.eu10.bdcfos.cloud.sap/dss
export LOCAL_DEBUG=true
$ npm run start
```

## How to Run Locally in Docker Image

1. Build image
```shell
$ cd ring-deployment-tests
$ sudo docker build --build-arg "CREDS_NPM_TOKEN=$CREDS_NPM_TOKEN" --no-cache -t fos-delivery-notification-rdt .
```
2. Run tests against service in `eu10-poc`:
```shell
$ sudo docker run -e LOCAL_DEBUG=true -e SERVICE_URL=https://delivery-notification.c-2d7b426.kyma.ondemand.com fos-delivery-notification-rdt
```
