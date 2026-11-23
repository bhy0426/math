const { Model, DataTypes } = require('sequelize');
const { required, createdAt } = require('./attributes');

module.exports = class BroadcastDelivery extends Model {
    static init(sequelize) {
        return super.init(
            {
                request_id: { type: DataTypes.CHAR(36), primaryKey: true },
                user_id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
                status: { ...required(DataTypes.STRING(12)), defaultValue: 'pending' },
                updated_at: createdAt(),
            },
            {
                sequelize,
                modelName: 'mail_broadcast_deliveries',
                tableName: 'mail_broadcast_deliveries',
                timestamps: false,
                freezeTableName: true,
            },
        );
    }

    static associate(db) {
        this.belongsTo(db.Broadcast, {
            as: 'broadcast',
            foreignKey: 'request_id',
            onDelete: 'CASCADE',
        });
    }
};
