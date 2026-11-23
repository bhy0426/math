const { Model, DataTypes } = require('sequelize');
const { required } = require('./attributes');

module.exports = class SignupCode extends Model {
    static init(sequelize) {
        return super.init(
            {
                email: { type: DataTypes.STRING(254), primaryKey: true },
                session_hash: required(DataTypes.CHAR(64)),
                code_hash: required(DataTypes.CHAR(64)),
                attempts: { ...required(DataTypes.INTEGER.UNSIGNED), defaultValue: 0 },
                sent_at: { type: DataTypes.DATE(3), allowNull: true },
                expires_at: required(DataTypes.DATE(3)),
            },
            {
                sequelize,
                modelName: 'signup_codes',
                tableName: 'signup_codes',
                timestamps: false,
                freezeTableName: true,
                indexes: [{ fields: ['expires_at'] }],
            },
        );
    }
};
