const { Model, DataTypes } = require('sequelize');

module.exports = class GroupMember extends Model {
    static init(sequelize) {
        return super.init(
            {
                group_id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
                user_id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
            },
            {
                sequelize,
                modelName: 'group_members',
                tableName: 'group_members',
                timestamps: false,
                freezeTableName: true,
            },
        );
    }

    static associate(db) {
        this.belongsTo(db.Group, { as: 'group', foreignKey: 'group_id', onDelete: 'CASCADE' });
        this.belongsTo(db.User, { as: 'student', foreignKey: 'user_id', onDelete: 'CASCADE' });
    }
};
