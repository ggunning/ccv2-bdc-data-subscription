--liquibase formatted sql

--changeset i026315:create_user runInTransaction:true dbms:postgresql
CREATE ROLE "${schema_username}" WITH
	LOGIN
	NOSUPERUSER
	NOCREATEDB
	NOCREATEROLE
	INHERIT
	NOREPLICATION
	NOBYPASSRLS
	CONNECTION LIMIT -1
	PASSWORD '${schema_password}';

--changeset i026315:create_schema_name runInTransaction:true dbms:postgresql
CREATE SCHEMA "${schema_name}";
GRANT ALL ON SCHEMA "${schema_name}" TO "${schema_username}";
ALTER DEFAULT PRIVILEGES IN SCHEMA "${schema_name}" GRANT ALL ON TABLES TO "${schema_username}";

--changeset i026315:create_table_dataSubscriptions runInTransaction:true dbms:postgresql
CREATE TABLE "${schema_name}"."dataSubscriptions"
(
    "id" uuid NOT NULL,
    "subscriber" text NOT NULL,
    "producer" text NOT NULL,
    "dataSourceId" text NOT NULL,
    "schedule" text NOT NULL,
    "beginWatermark" timestamp with time zone NOT NULL,
    "upperWatermark" timestamp with time zone NOT NULL,
    "destinationPath" text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "dataSubscriptions_pkey" PRIMARY KEY (id)
);
-- rollback drop table if exists "${schema_name}"."dataSubscriptions" cascade;

--changeset i515814:add_column_version runInTransaction:true dbms:postgresql
ALTER TABLE "${schema_name}"."dataSubscriptions" ADD version integer NOT NULL DEFAULT 0;

--changeset i070454:table_20241129 runInTransaction:true dbms:postgresql
ALTER TABLE "${schema_name}"."dataSubscriptions" ADD active boolean NOT NULL DEFAULT TRUE;
-- rollback ALTER TABLE "${schema_name}"."dataSubscriptions" DROP COLUMN IF EXISTS active;
