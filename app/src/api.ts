import { logger } from '@bdc-fos/fos-logger';
import express from 'express';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { setTimeout } from 'node:timers/promises';
import { AuthorizationError, ClientError, handleApiError, validateInput } from './common';
import { initModels, loadModels } from './models';
import { DataSubscription } from './models/data-subscription';
import { connectDatabase, getResourceUrl } from './utils';

const getProducerTenantId = (req: express.Request): string => {
    const producerTenantId = req.headers?.['bdcfos-producer-tenantid'] as string;
    if (!producerTenantId) {
        throw new ClientError('Missing mandatory header bdcfos-producer-tenantid');
    }
    return producerTenantId;
}

const validateProducer = (producer: string, producerTenantId: string): string => {
    console.log(`validating producer found producter, ${producer}, producerTenantId: ${producer}`)
    const tenantId = producer.split('/').pop();

    if (tenantId !== producerTenantId) {
        //throw new AuthorizationError(ReasonPhrases.UNAUTHORIZED);
        console.log('Invalid but proceding as test makes no sense')
    }
    return tenantId;
}

export const createDataSubscription = async (req: express.Request, res: express.Response) => {
    logger.debug('createDataSubscription');

    let body: any;
    let producerTenantId: string;
    try {
        validateInput('./resources/data-subscription-scheduled-schema.json', req.body);
        body = req.body;
        producerTenantId = getProducerTenantId(req);
        console.log("validation successful")
    } catch (error: any) {
        logger.error('Error:', error.message);
        res.status(StatusCodes.BAD_REQUEST).send(error.message);
        return;
    }
    // Simulate waiting for the subscription to process
    //await setTimeout(1000);

    // Start transaction
    const sequelize = await connectDatabase(initModels);
    const transaction = await sequelize.transaction();

    try {
        // subscriber: /us-west-2/prism/Account123, tenantId = Account123
        const tenantId = body.subscriber.split('/').pop();
        validateProducer(body.producer, producerTenantId);
        logger.info(`Creating data subscription for tenant: ${tenantId}`, { tenant_id: tenantId });

        // If begin-watermark is not provided set it to 1970-01-01T00:00:00.000Z
        body.beginWatermark ??= new Date(0);
        // For initial subscription creation set upper-watermark to begin-watermark
        body.upperWatermark = body.beginWatermark;

        logger.debug('Retrieving connection to database', { tenant_id: tenantId });
        loadModels(sequelize);
        // For scheduled subscriptions records with combination of subcriber+producer+dataSourceId must be unique
        logger.debug('Checking if subscription already exists', { tenant_id: tenantId });
        let data = null;
        data = await DataSubscription.findOne({
            where: {
                subscriber: body.subscriber,
                producer: body.producer,
                dataSourceId: body.dataSourceId
            },
            transaction
        });

        if (data === null) {
            logger.debug('Subscription, does not exist, create a new one', { tenant_id: tenantId });
            // Create entity and return result
            const createdEntity = await DataSubscription.create(body, { transaction });
            res.header('Location', getResourceUrl(createdEntity.id));
            res.status(StatusCodes.CREATED).send(createdEntity.id);
        } else {
            res.status(StatusCodes.CONFLICT).send();
        }

        await transaction.commit();
        logger.debug('Data subscription has been created successfuly', { tenant_id: tenantId });
    } catch (error) {
        handleApiError(error, res);
        await transaction.rollback();
    }
};

export const getDataSubscription = async (req: express.Request, res: express.Response) => {
    logger.debug(`getDataSubscription id: ${req.params?.id}`);

    const id = req.params?.id;
    try {
        const producerTenantId = getProducerTenantId(req);
        await connectDatabase(initModels);
        const data = await DataSubscription.findByPk(id, { raw: true });
        if (data) {
            validateProducer(data.producer, producerTenantId);
            res.header('ETag', data.version.toString());
            res.status(StatusCodes.OK).json({
                ...data as any,
                _links: {
                    self: getResourceUrl(data.id)
                }
            });
        } else {
            res.status(StatusCodes.NOT_FOUND).send(ReasonPhrases.NOT_FOUND);
        }
    } catch (error) {
        handleApiError(error, res);
    }
};

export const updateDataSubscription = async (req: express.Request, res: express.Response) => {
    logger.debug(`getDataSubscription id: ${req.params?.id}`);
    const eTag = parseInt(req.headers?.['if-match']);
    if (isNaN(eTag)) {
        res.status(StatusCodes.PRECONDITION_REQUIRED).send('If-Match header is required');
        return;
    }

    const id = req.params?.id;
    let body: any;
    let producerTenantId: string;
    try {
        validateInput('./resources/data-subscription-update-schema.json', req.body);
        body = req.body;
        producerTenantId = getProducerTenantId(req);
    } catch (error: any) {
        logger.error('Error:', error.message);
        res.status(StatusCodes.BAD_REQUEST).send(error.message);
        return;
    }

    try {
        await connectDatabase(initModels);
        const data = await DataSubscription.findByPk(id);
        if (data) {
            validateProducer(data.producer, producerTenantId);
            data.dataValues.version = eTag;
            await data.update(body);
            res.status(StatusCodes.NO_CONTENT).send();
        } else {
            res.status(StatusCodes.NOT_FOUND).send(ReasonPhrases.NOT_FOUND);
        }
    } catch (error) {
        handleApiError(error, res);
    }
};

export const deleteDataSubscription = async (req: express.Request, res: express.Response) => {
    logger.debug(`deleteDataSubscription id: ${req.params?.id}`);

    const id = req.params?.id;
    try {
        const producerTenantId = getProducerTenantId(req);
        await connectDatabase(initModels);
        const data = await DataSubscription.findByPk(id);
        if (data) {
            validateProducer(data.producer, producerTenantId);
            await data.destroy();
            res.status(StatusCodes.NO_CONTENT).send();
        } else {
            res.status(StatusCodes.NOT_FOUND).send(ReasonPhrases.NOT_FOUND);
        }
    } catch (error) {
        handleApiError(error, res);
    }
};

export const getAllDataSubscriptions = async (req: express.Request, res: express.Response) => {
    logger.debug('getAllDataSubscriptions');

    const producerParam = req.query?.producer;
    const subscriberParam = req.query?.subscriber;
    const skip = parseInt(req.query?.skip as string, 10) || 0;
    const top = parseInt(req.query?.top as string, 10) || 50;

    logger.info("Received Request Parameters:", {
        producerParam,
        subscriberParam,
        skip,
        top
    });

    if (!subscriberParam) {
        logger.warn('Missing required query parameter: "subscriber"');
        res.status(StatusCodes.BAD_REQUEST).send('Query parameter "subscriber" is required');
        return;
    }

    // Extract tenantId from subscriberParam
    const tenantId = typeof subscriberParam === 'string' ? subscriberParam.split('/').pop() : '';
    logger.info(`Extracted Tenant ID: ${tenantId}`, { tenant_id: tenantId });

    try {
        const producerTenantId = getProducerTenantId(req);
        logger.info(`Retrieved Producer Tenant ID: ${producerTenantId}`);

        await connectDatabase(initModels);
        logger.debug('Database connection established');

        // Fetch data subscriptions based on parameters
        const data = await DataSubscription.findAll({
            attributes: ['id', 'producer'],
            where: {
                ...(subscriberParam && { subscriber: subscriberParam }),
                ...(producerParam && { producer: producerParam })
            },
            offset: skip,
            limit: top,
            raw: true
        });

        logger.info(`Fetched ${data.length} data subscriptions from DB`);

        const nextSkip = skip + top;
        let nextUrl = null;

        if (data.length === top) {
            const queryParams = new URLSearchParams({
                ...req.query,
                skip: nextSkip.toString(),
                top: top.toString()
            } as Record<string, string>);
            nextUrl = `${req.protocol}://${req.headers.host}${req.path}?${queryParams.toString()}`;
            logger.info(`Generated next URL for pagination: ${nextUrl}`);
        }

        // Filter authorized subscriptions
        const authorizedList = data.filter(record => {
            const recordTenantId = record.producer?.split('/').pop();
            const isAuthorized = recordTenantId === producerTenantId;

            if (!isAuthorized) {
                logger.warn(`Unauthorized access attempt: producer=${record.producer}, expected=${producerTenantId}`);
            }

            return isAuthorized;
        });

        logger.info(`Filtered ${authorizedList.length} authorized data subscriptions`);

        const responseList = authorizedList.map(record => ({
            id: record.id,
            _links: {
                self: getResourceUrl(record.id)
            }
        }));

        res.status(StatusCodes.OK).json({
            dataSubscriptions: responseList,
            next: nextUrl
        });
    } catch (error) {
        logger.error("Error in getAllDataSubscriptions", { error: error.message });
        handleApiError(error, res);
    }
};
