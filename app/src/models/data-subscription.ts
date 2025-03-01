import { DataTypes, Model, Sequelize } from 'sequelize';

// Data subscription model
export class DataSubscription extends Model {
    id: string;
    subscriber: string;
    producer: string;
    dataSourceId: string;
    schedule: string;
    beginWatermark: Date;
    upperWatermark: Date;
    destinationPath: string;
    version: number;
    createdAt?: Date;
    updatedAt?: Date;
    active: boolean;
}

export const dataSubscriptionModelInit = (sequelize: Sequelize) => {
    DataSubscription.init(
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
            sequelize,
            tableName: 'dataSubscriptions',
            version: true
        }
    );
};
