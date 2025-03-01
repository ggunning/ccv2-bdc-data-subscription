import { convertToSafeError, logger } from '@bdc-fos/fos-logger';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { serviceInfo, getDatabaseHealth, HealthStatus } from './utils';

export const getHealth = async (req: Request, res: Response) => {
    try {
        const readiness = await getDatabaseHealth();
        res.status(readiness.statusCode).json({
            status: readiness.status,
            serviceInfo,
            components: {
                db: { status: readiness.status, database: 'postgres' }
            }
        });
    } catch (error) {
        logger.error('getHealth: Failed to connect to database: ', convertToSafeError(error));
        res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
            status: HealthStatus.DOWN,
            serviceInfo,
            components: {
                db: { status: HealthStatus.DOWN, database: 'postgres' }
            }
        });
    }
};

export const getLiveness = (req: Request, res: Response) => {
    res.status(StatusCodes.OK).json({ status: HealthStatus.UP });
};

export const getReadiness = async (req: Request, res: Response) => {
    try {
        const readiness = await getDatabaseHealth();
        res.status(readiness.statusCode).json({ status: readiness.status });
    } catch (error) {
        logger.error('getReadiness: Failed to connect to database: ', convertToSafeError(error));
        res.status(StatusCodes.SERVICE_UNAVAILABLE).json({ status: HealthStatus.DOWN });
    }
};
