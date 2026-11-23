const { Model, DataTypes } = require('sequelize');
const { primaryId, required, createdAt } = require('./attributes');

module.exports = class Question extends Model {
    static init(sequelize) {
        return super.init(
            {
                id: primaryId(),
                user_id: DataTypes.INTEGER.UNSIGNED,
                title: required(DataTypes.STRING(160)),
                content: required(DataTypes.TEXT),
                is_private: { ...required(DataTypes.BOOLEAN), defaultValue: true },
                answer: DataTypes.TEXT,
                answered_by: DataTypes.INTEGER.UNSIGNED,
                created_at: createdAt(),
            },
            {
                sequelize,
                modelName: 'questions',
                tableName: 'questions',
                timestamps: false,
                freezeTableName: true,
            },
        );
    }

    static associate(db) {
        this.belongsTo(db.User, { as: 'author', foreignKey: 'user_id', onDelete: 'SET NULL' });
        this.belongsTo(db.User, {
            as: 'answerer',
            foreignKey: 'answered_by',
            onDelete: 'SET NULL',
        });
    }
};
