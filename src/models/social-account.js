const { Model, DataTypes } = require('sequelize');
const { required, createdAt } = require('./attributes');

module.exports = class SocialAccount extends Model {
    static init(sequelize) {
        return super.init(
            {
                provider: { type: DataTypes.ENUM('kakao', 'google'), primaryKey: true },
                app_key_hash: { type: DataTypes.CHAR(64), primaryKey: true },
                provider_user_id: { type: DataTypes.STRING(255), primaryKey: true },
                user_id: required(DataTypes.INTEGER.UNSIGNED),
                // 카카오는 앱별로, 구글은 모든 앱을 통틀어 회원당 한 계정만 연결한다.
                user_scope: required(DataTypes.STRING(64)),
                created_at: createdAt(),
            },
            {
                sequelize,
                modelName: 'social_accounts',
                tableName: 'social_accounts',
                timestamps: false,
                freezeTableName: true,
                indexes: [
                    {
                        name: 'one_social_account_per_user_scope',
                        unique: true,
                        fields: ['provider', 'user_scope', 'user_id'],
                    },
                ],
                hooks: {
                    beforeValidate(account) {
                        account.user_scope =
                            account.provider === 'google' ? '' : account.app_key_hash;
                    },
                },
            },
        );
    }

    static associate(db) {
        this.belongsTo(db.User, { as: 'user', foreignKey: 'user_id', onDelete: 'CASCADE' });
    }
};
