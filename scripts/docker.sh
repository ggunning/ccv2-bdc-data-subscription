#!/bin/bash

# docker system prune -a 

if [ "$(uname -m)" = "arm64" ]; then
    echo "This is Apple"
    docker build --build-arg CREDS_NPM_TOKEN=${CREDS_NPM_TOKEN} --platform linux/arm64 -t fos-data-subscription-svc:latest .
else
    echo "This is non-Apple"
    docker build --build-arg CREDS_NPM_TOKEN=${CREDS_NPM_TOKEN} -t fos-data-subscription-svc:latest .
fi

docker run -it fos-data-subscription-svc