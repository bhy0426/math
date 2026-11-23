const { Model, DataTypes } = require('sequelize');
const { required } = require('./attributes');

module.exports = class Broadcast extends Model {
    static init(sequelize) {
        return super.init(
            {
                request_id: { type: DataTypes.CHAR(36), primaryKey: true },
                admin_id: required(DataTypes.INTEGER.UNSIGNED),
                input_hash: required(DataTypes.CHAR(64)),
            },
            {
                sequelize,
                modelName: 'mail_broadcasts',
                tableName: 'mail_broadcasts',
                timestamps: false,
                freezeTableName: true,
            },
        );
    }
};
