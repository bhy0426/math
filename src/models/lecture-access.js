const { Model, DataTypes } = require('sequelize');
const { required } = require('./attributes');

module.exports = class LectureAccess extends Model {
    static init(sequelize) {
        return super.init(
            {
                user_id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
                lecture_id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true },
                starts_at: required(DataTypes.DATE),
                expires_at: required(DataTypes.DATE),
                granted_by: DataTypes.INTEGER.UNSIGNED,
            },
            {
                sequelize,
                modelName: 'lecture_access',
                tableName: 'lecture_access',
                timestamps: false,
                freezeTableName: true,
            },
        );
    }

    static associate(db) {
        this.belongsTo(db.User, { as: 'user', foreignKey: 'user_id', onDelete: 'CASCADE' });
        this.belongsTo(db.User, { as: 'grantor', foreignKey: 'granted_by', onDelete: 'SET NULL' });
        this.belongsTo(db.Lecture, {
            as: 'lecture',
            foreignKey: 'lecture_id',
            onDelete: 'CASCADE',
        });
    }
};
