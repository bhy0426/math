const { Model, DataTypes } = require('sequelize');
const { required } = require('./attributes');

module.exports = class MemberField extends Model {
    static init(sequelize) {
        return super.init(
            {
                key: { type: DataTypes.STRING(20), primaryKey: true },
                enabled: { ...required(DataTypes.BOOLEAN), defaultValue: true },
            },
            {
                sequelize,
                modelName: 'member_fields',
                tableName: 'member_fields',
                timestamps: false,
                freezeTableName: true,
            },
        );
    }
};
