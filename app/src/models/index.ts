import { logger } from '@bdc-fos/fos-logger';
import { Sequelize, Options } from 'sequelize';
import { dataSubscriptionModelInit } from './data-subscription';

export const loadModels =  (sequelize: Sequelize): Sequelize => {
    dataSubscriptionModelInit(sequelize);
    return sequelize;
};

export const initModels = (uri: string, options: Options): Sequelize => {
    logger.info('🔹 initModels called');
    console.log("🟢 About to initialize Sequelize with URI:", uri);
    
    let sequelize = new Sequelize(uri, options);

    console.log("✅ Sequelize instance created successfully.");
    console.log("🟡 Loading models into Sequelize...");
    
    sequelize = loadModels(sequelize);

    console.log("✅ Models loaded successfully. Returning Sequelize instance.");
    return sequelize;
};
