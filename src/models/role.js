const { Model, DataTypes } = require('sequelize');
const { primaryId, required } = require('./attributes');

module.exports = class Role extends Model {
    static init(sequelize) {
        return super.init(
            {
                id: primaryId(),
                code: { ...required(DataTypes.STRING(40)), unique: true },
                name: required(DataTypes.STRING(80)),
                can_manage: { ...required(DataTypes.BOOLEAN), defaultValue: false },
            },
            {
                sequelize,
                modelName: 'roles',
                tableName: 'roles',
                timestamps: false,
                freezeTableName: true,
            },
        );
    }

    static associate(db) {
        this.hasMany(db.User, { as: 'users', foreignKey: 'role_id', onDelete: 'RESTRICT' });
    }
};
