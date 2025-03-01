#!/bin/bash

if [ -z "${SCHEMA_NAME}" ]; then
  >&2 echo "ERROR: SCHEMA_NAME is not set"
  CONFIGURATION_ERROR_FOUND=true
else
  echo "SCHEMA_NAME is set"
fi

if [ -z "${SCHEMA_USERNAME}" ]; then
  >&2 echo "ERROR: SCHEMA_USERNAME is not set"
  CONFIGURATION_ERROR_FOUND=true
else
  echo "SCHEMA_USERNAME is set"
fi

if [ -z "${SCHEMA_PASSWORD}" ]; then
    >&2 echo "ERROR: SCHEMA_PASSWORD is not set"
    CONFIGURATION_ERROR_FOUND=true
  # fi
else
  echo "SCHEMA_PASSWORD is set"
fi

if [ "${CONFIGURATION_ERROR_FOUND}" = true ]; then
  >&2 echo "ERROR: Mandatory environment variables are missing. Execution terminated"
  exit 1
fi

# Read each line from the file, replace the string, and write to a temporary file
while IFS= read -r line; do
  # Perform the substitution
  modified_line=$(echo "$line" | sed -e "s/#SCHEMA_NAME#/$SCHEMA_NAME/g" -e "s/#SCHEMA_USERNAME#/$SCHAME_USERNAME/g" -e "s/#SCHEMA_PASSWORD#/$SCHEMA_PASSWORD/g")
  # Write the modified line to the temporary file
  echo "$modified_line" >> "/tmp/file"
done < "./changelog/changelog-init.xml"

# Move the temporary file back to the original file
mv "/tmp/file" "./changelog/changelog-init.xml"
