# Liquibase

## Links

- https://www.liquibase.com
- https://www.npmjs.com/package/liquibase

## Docker Locally

1. Test if docker deamon is running: `$ sudo docker ps`
2. Build: `$ sudo docker build --build-arg "CREDS_NPM_TOKEN=$CREDS_NPM_TOKEN" --no-cache -t fos-data-subscription-svc-liquibase .`
3. Run container: `$ sudo docker run fos-data-subscription-svc-liquibase`
4. List running docker containers: `$ sudo docker ps -a`
5. Remove docker container `$ sudo docker rm <CONTAINER ID>`
6. List docker images `$ sudo docker images`
7. Remove docker image `$ sudo docker rmi fos-data-subscription-svc-liquibase`
