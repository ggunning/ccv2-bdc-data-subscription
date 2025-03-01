# This Dockerfile is created based on https://github.com/liquibase/docker/blob/main/Dockerfile
FROM bdc-fos-docker-jenkins.int.repositories.cloud.sap/suse-sle:1.0.2@sha256:e0a883a85850fb4ecfd7d9e002045c2a1707c3afcc7dac00ff46915e88cf8439

# SAP JVM Release Version
ARG SAPMACHINE_VERSION=17.0.13
# Liquibase Release Version
ARG LIQUIBASE_VERSION=4.30.0
# ARG LB_SHA256=01eeb8ce80cd94993e938240c3da6d167cbbf49a6b2e499401e52b8c7a8c817b

# Artifactory credential
ARG ARTIFACTORY_CRED_USR
ARG ARTIFACTORY_CRED_PSW

# Add the liquibase user and step in the directory
RUN groupadd -g 65553 liquibase \
    && useradd -u 65553 -g 65553 liquibase

# Make /liquibase directory and change owner to liquibase
RUN mkdir /liquibase && chown liquibase /liquibase
WORKDIR /liquibase

# Set JAVA_HOME environment variable
ENV JAVA_HOME="/liquibase/sapmachine-jre-${SAPMACHINE_VERSION}"
# Set LIQUIBASE_HOME environment variable
ENV LIQUIBASE_HOME=/liquibase

# Symbolic link will be broken until later
RUN ln -s /liquibase/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh \
  && ln -s /liquibase/docker-entrypoint.sh /docker-entrypoint.sh \
  && ln -s /liquibase/liquibase /usr/local/bin/liquibase \
  && ln -s /liquibase/sapmachine-jre-${SAPMACHINE_VERSION}/bin/java /usr/local/bin/java

# Change to the liquibase user
USER liquibase:liquibase

# Download, verify, extract SAP JVM
RUN curl -sLO "https://github.com/SAP/SapMachine/releases/download/sapmachine-${SAPMACHINE_VERSION}/sapmachine-jre-${SAPMACHINE_VERSION}_linux-x64_bin.tar.gz" \
  && curl -sLO "https://github.com/SAP/SapMachine/releases/download/sapmachine-${SAPMACHINE_VERSION}/sapmachine-jre-${SAPMACHINE_VERSION}_linux-x64_bin.sha256.txt" \
  && sha256sum --check "sapmachine-jre-${SAPMACHINE_VERSION}_linux-x64_bin.sha256.txt" \
  && tar -xzvf sapmachine-jre-${SAPMACHINE_VERSION}_linux-x64_bin.tar.gz \
  && rm sapmachine-jre-${SAPMACHINE_VERSION}_linux-x64_bin.tar.gz

# Print JVM version
RUN java -version

# Download, verify, extract + delete drivers Data Platform does not use
RUN set -x \
  && curl -sL -o liquibase-${LIQUIBASE_VERSION}.tar.gz "https://github.com/liquibase/liquibase/releases/download/v${LIQUIBASE_VERSION}/liquibase-${LIQUIBASE_VERSION}.tar.gz" \
  # && echo "$LB_SHA256  liquibase-${LIQUIBASE_VERSION}.tar.gz" | sha256sum -c - \
  && tar -xzf liquibase-${LIQUIBASE_VERSION}.tar.gz \
  && rm liquibase-${LIQUIBASE_VERSION}.tar.gz \
  && rm -f /liquibase/internal/lib/h2.jar /liquibase/internal/lib/mssql-jdbc.jar  \
    /liquibase/internal/lib/mariadb-java-client.jar /liquibase/internal/lib/hsqldb.jar  \
    /liquibase/internal/lib/sqlite-jdbc.jar /liquibase/internal/lib/ojdbc8.jar  \
    /liquibase/internal/lib/snowflake-jdbc.jar \
  && mkdir -p /liquibase/classpath /liquibase/changelog

COPY --chown=liquibase:liquibase ./docker/main/docker-entrypoint.sh /liquibase/
COPY --chown=liquibase:liquibase ./docker/main/liquibase.docker.properties /liquibase/

# Print liquibase version
RUN /liquibase/liquibase --version

# Data Platform: copy database scripts
#ADD --chown=liquibase:liquibase ./db/changelog /liquibase/changelog
ADD --chown=liquibase:liquibase ./docker/scripts /liquibase/scripts

# Data Platform: copy database scripts
ADD --chown=liquibase:liquibase ./db/changelog /liquibase/changelog

RUN chmod a+wx ./changelog/

# Data Platform: execute a database upgrade command by default
CMD ["/bin/sh", "-c", "source ./scripts/setupenv.sh && ./scripts/update-changelog-init.sh && ./scripts/command.sh"]
