if [ -z "${POSTGRES_USERNAME}" ]; then
  echo "POSTGRES_USERNAME is not set"
else
  echo "POSTGRES_USERNAME is set"
fi

if [ -z "${POSTGRES_PASSWORD}" ]; then
  echo "POSTGRES_PASSWORD is not set"
else
  echo "POSTGRES_PASSWORD is set"
fi

if [ -z "${POSTGRES_PORT}" ]; then
  >&2 echo "ERROR: POSTGRES_PORT is not set"
  CONFIGURATION_ERROR_FOUND=true
else
  echo "POSTGRES_PORT is set"
fi

if [ -z "${POSTGRES_HOST}" ]; then
  >&2 echo "ERROR: POSTGRES_HOST is not set (e.g. 'localhost')"
  CONFIGURATION_ERROR_FOUND=true
else
  echo "POSTGRES_HOST is set"
fi

if [ -z "${CHANGELOG_FILE}" ]; then
  >&2 echo "ERROR: CHANGELOG_FILE is not set"
  CONFIGURATION_ERROR_FOUND=true
else
  echo "CHANGELOG_FILE is set to '${CHANGELOG_FILE}'"
fi

if [ -z "${CHANGELOG_COMMAND}" ]; then
  >&2 echo "ERROR: CHANGELOG_COMMAND is not set"
  CONFIGURATION_ERROR_FOUND=true
else
  echo "CHANGELOG_COMMAND is set to '${CHANGELOG_COMMAND}'"
fi

if [ "$CONFIGURATION_ERROR_FOUND" = true ]; then
  >&2 echo 'ERROR: Mandatory environment variables are missing. Execution terminated'
  exit 1
fi

if [ -z "${POSTGRES_DB}" ]; then
  echo "POSTGRES_DB is not set."  
else
  echo "POSTGRES_DB is set to '${POSTGRES_DB}'"
fi

# if [ -n "${POSTGRES_JDBC_OPTIONS}" ]; then
#   POSTGRES_JDBC_OPTIONS="?${POSTGRES_JDBC_OPTIONS}"
# fi

# set liquibase environment variables
export LIQUIBASE_COMMAND_URL="jdbc:postgresql://${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
echo "Setting LIQUIBASE_COMMAND_URL to '${LIQUIBASE_COMMAND_URL}'"
export LIQUIBASE_COMMAND_USERNAME="${POSTGRES_USERNAME}"
export LIQUIBASE_COMMAND_PASSWORD="${POSTGRES_PASSWORD}"
export LIQUIBASE_COMMAND_CHANGELOG_FILE="${CHANGELOG_FILE}"
# determine liquibase contexts to execute depending on environment
# if [[ "$TARGET_ENV" =~ sit ]]; then
#   echo "SIT environment detected: '$TARGET_ENV'"
#   export LIQUIBASE_COMMAND_CONTEXTS='!invalid,sit'
# else
#   echo "Non-SIT environment detected: '$TARGET_ENV'"
#   export LIQUIBASE_COMMAND_CONTEXTS='!invalid'
# fi
# echo "Liquibase contexts to execute: '${LIQUIBASE_COMMAND_CONTEXTS}'"
export LIQUIBASE_DEFAULTS_FILE=/liquibase/liquibase.docker.properties
