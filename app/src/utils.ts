import { convertToSafeError, logger } from '@bdc-fos/fos-logger';
import { readFileSync } from 'fs';
import { StatusCodes } from 'http-status-codes';
import path from 'path';
import type { Options, Sequelize } from 'sequelize';
import { getPostgresService } from "./common";
import { initModels } from './models';

export const getAppUrl = (): string => process.env.API_URL || 'http://localhost:3000';
export enum HealthStatus {
    UP = 'UP',
    DOWN = 'DOWN'
};

export const getResourceUrl = (id: string): string => {
    const appEnv = { url: getAppUrl() };
    return `${appEnv.url}/v0/dataSubscriptions/${id}`;
};

// Use readFileSync instead of import package.json because import will result in tsc build result as bin/src/*.js
const { name } = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

// Health API - Unprotected
const { SERVICE_VERSION } = process.env;

export const serviceInfo = {
    name,
    version: SERVICE_VERSION
};

export const connectDatabase = async (cdInitModels: (uri: string, options: Options) => Sequelize, logLevel = 'silly', schema?: string): Promise<Sequelize | undefined> => {
    const dbCredentials = getPostgresService()
    const database: Sequelize = cdInitModels(dbCredentials.uri, {
        dialect: 'postgres',
        dialectOptions: {
            ssl: {
                rejectUnauthorized: true,
                ca: dbCredentials.sslcert
            }
        },
        logging: (msg: string) => logger.log(logLevel, msg),
        schema: schema ?? process.env.SCHEMA_NAME
    });
    try {
        await database.authenticate();
        logger.info('connectDatabase: Connection has been established successfully.');
        return database;
    } catch (error) {
        logger.error('connectDatabase: Failed to connect to database with error: ', convertToSafeError(error));
        return undefined;
    }
};

export const queryDatabase = async (database: Sequelize, query: string): Promise<any> => {
    try {
        logger.info(`queryDatabase: Running query ${query}`);
        const result = await database.query(query);
        return result;
    } catch (error) {
        logger.error('queryDatabase: Failed to execute query with error: ', convertToSafeError(error));
        return undefined;
    }
};

export const getDatabaseHealth = async (): Promise<{ statusCode: StatusCodes, status: string }> => {
    const database = await connectDatabase(initModels);
    const result = await queryDatabase(database, 'SELECT 1');
    return result ? { statusCode: StatusCodes.OK, status: HealthStatus.UP } : { statusCode: StatusCodes.SERVICE_UNAVAILABLE, status: 'DOWN'};
};