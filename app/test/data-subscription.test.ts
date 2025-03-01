import { Sequelize, Model, DataTypes } from 'sequelize';
import { dataSubscriptionModelInit, DataSubscription } from '../src/models/data-subscription'; // Replace with the actual module path

jest.mock('sequelize');
const mockModelInit = Model.init as jest.Mock<unknown>;
mockModelInit.mockReturnValueOnce(true);

describe('dataSubscriptionModelInit', () => {
    test('should call Model.init with the correct model definition', () => {
        const sequelizeMock = new Sequelize('sqlite::memory:'); // You can use any other database for testing

        // Call the function to initialize the model
        dataSubscriptionModelInit(sequelizeMock);

        // Check if Sequelize.init is called with the correct arguments
        expect(mockModelInit).toHaveBeenCalledWith(
            {
                id: {
                    type: DataTypes.UUID,
                    primaryKey: true,
                    allowNull: false,
                    defaultValue: DataTypes.UUIDV4
                },
                subscriber: {
                    type: DataTypes.TEXT,
                    allowNull: false
                },
                producer: {
                    type: DataTypes.TEXT,
                    allowNull: false
                },
                dataSourceId: {
                    type: DataTypes.TEXT,
                    allowNull: false
                },
                schedule: {
                    type: DataTypes.TEXT
                },
                beginWatermark: {
                    type: DataTypes.DATE,
                    allowNull: false
                },
                upperWatermark: {
                    type: DataTypes.DATE,
                    allowNull: false
                },
                destinationPath: {
                    type: DataTypes.TEXT,
                    allowNull: false
                },
                version: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                    defaultValue: 0
                },
                active: {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: true
                }
            },
            {
                sequelize: sequelizeMock,
                tableName: 'dataSubscriptions',
                version: true
            }
        );

        // Check if the model is correctly initialized and set to DeliveryNotification class
        expect(DataSubscription.init).toHaveBeenCalled();
    });
});
