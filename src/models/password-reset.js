const { Model, DataTypes } = require('sequelize');
const { required } = require('./attributes');

module.exports = class PasswordReset extends Model {
    static init(sequelize) {
        return super.init(
            {
                token_hash: { type: DataTypes.CHAR(64), primaryKey: true },
                user_id: required(DataTypes.INTEGER.UNSIGNED),
                expires_at: required(DataTypes.DATE),
                used_at: DataTypes.DATE,
            },
            {
                sequelize,
                modelName: 'password_resets',
                tableName: 'password_resets',
                timestamps: false,
                freezeTableName: true,
            },
        );
    }

    static associate(db) {
        this.belongsTo(db.User, { as: 'user', foreignKey: 'user_id', onDelete: 'CASCADE' });
    }
};
