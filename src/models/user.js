const { Model, DataTypes } = require('sequelize');
const { primaryId, required, createdAt } = require('./attributes');

module.exports = class User extends Model {
    static init(sequelize) {
        return super.init(
            {
                id: primaryId(),
                // 기존 회원을 보존한다. API·모델은 nickname, 기존 DB 열은 name이다.
                nickname: { type: DataTypes.STRING(80), field: 'name' },
                email: { type: DataTypes.STRING(254), unique: true },
                username: { type: DataTypes.STRING(40), unique: true },
                password_hash: required(DataTypes.STRING(200)),
                role_id: required(DataTypes.INTEGER.UNSIGNED),
                status: {
                    ...required(DataTypes.ENUM('pending', 'active', 'suspended')),
                    defaultValue: 'pending',
                },
                session_version: { ...required(DataTypes.INTEGER.UNSIGNED), defaultValue: 0 },
                created_at: createdAt(),
            },
            {
                sequelize,
                modelName: 'users',
                tableName: 'users',
                timestamps: false,
                freezeTableName: true,
                indexes: [{ name: 'users_nickname_unique', unique: true, fields: ['name'] }],
            },
        );
    }

    static associate(db) {
        this.belongsTo(db.Role, { as: 'roleRecord', foreignKey: 'role_id', onDelete: 'RESTRICT' });
        this.hasMany(db.GroupMember, {
            as: 'memberships',
            foreignKey: 'user_id',
            onDelete: 'CASCADE',
        });
    }
};
