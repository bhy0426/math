const { Model, DataTypes } = require('sequelize');
const { primaryId, required, createdAt } = require('./attributes');

module.exports = class Board extends Model {
    static init(sequelize) {
        return super.init(
            {
                id: primaryId(),
                title: required(DataTypes.STRING(160)),
                content: required(DataTypes.TEXT),
                author_id: DataTypes.INTEGER.UNSIGNED,
                is_pinned: { ...required(DataTypes.BOOLEAN), defaultValue: false },
                popup_enabled: { ...required(DataTypes.BOOLEAN), defaultValue: false },
                created_at: createdAt(),
            },
            {
                sequelize,
                modelName: 'boards',
                tableName: 'boards',
                timestamps: false,
                freezeTableName: true,
            },
        );
    }

    static associate(db) {
        this.belongsTo(db.User, { as: 'author', foreignKey: 'author_id', onDelete: 'SET NULL' });
    }
};
