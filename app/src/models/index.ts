import { logger } from '@bdc-fos/fos-logger';
import { Sequelize, Options } from 'sequelize';
import { dataSubscriptionModelInit } from './data-subscription';

export const loadModels =  (sequelize: Sequelize): Sequelize => {
    dataSubscriptionModelInit(sequelize);
    return sequelize;
};

export const initModels = (uri: string, options: Options): Sequelize => {
    logger.info('initModels');
    let sequelize = new Sequelize(uri, options);
    sequelize = loadModels(sequelize);
    return sequelize;
};
