import { Sequelize } from 'sequelize';
import * as dataSubscription from '../src/models/data-subscription';
import * as index from '../src/models/index';
import { initModels, loadModels } from '../src/models/index';

jest.mock('sequelize');

describe('deliveryNotificationModelInit', () => {
    test('should call deliveryNotificationModelInit', () => {
        const dataSubscriptionModelInitMock = jest.spyOn(dataSubscription, 'dataSubscriptionModelInit');

        loadModels({} as Sequelize);
        expect(dataSubscriptionModelInitMock).toHaveBeenCalledWith({} as Sequelize);
    });

    test('should call loadModels', () => {
        const loadModelsMock = jest.spyOn(index, 'loadModels').mockReturnValueOnce({} as Sequelize);
        initModels('postgres://MOCK_USER:MOCK_PASSWORD@MOCK_HOST:MOCK_PORT/MOCK_DB', { });
        expect(Sequelize).toHaveBeenCalledWith('postgres://MOCK_USER:MOCK_PASSWORD@MOCK_HOST:MOCK_PORT/MOCK_DB', { });
        expect(loadModelsMock).toHaveBeenCalled();
    });
});
