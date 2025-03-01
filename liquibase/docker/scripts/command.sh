# terminate execution with an error as soon as any command failed
set -e

if [ "$CHANGELOG_COMMAND" = "update" ]; then
  liquibase validate --url "${LIQUIBASE_COMMAND_URL}" --changelog-file "${CHANGELOG_FILE}" --username "${POSTGRES_USERNAME}" --password "${POSTGRES_PASSWORD}"
  liquibase update --url "${LIQUIBASE_COMMAND_URL}" --changelog-file "${CHANGELOG_FILE}" --username "${POSTGRES_USERNAME}" --password "${POSTGRES_PASSWORD}"
else
  >&2 echo "ERROR: Unknown changelog command: '${CHANGELOG_COMMAND}'"
  exit 1
fi
