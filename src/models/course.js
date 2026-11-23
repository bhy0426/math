const { Model, DataTypes } = require('sequelize');
const { primaryId, required, createdAt } = require('./attributes');

module.exports = class Course extends Model {
    static init(sequelize) {
        return super.init(
            {
                id: primaryId(),
                title: required(DataTypes.STRING(160)),
                description: required(DataTypes.TEXT),
                teacher: { ...required(DataTypes.STRING(80)), defaultValue: '' },
                is_published: { ...required(DataTypes.BOOLEAN), defaultValue: true },
                created_at: createdAt(),
            },
            {
                sequelize,
                modelName: 'courses',
                tableName: 'courses',
                timestamps: false,
                freezeTableName: true,
            },
        );
    }

    static associate(db) {
        this.hasMany(db.Lecture, { as: 'lectures', foreignKey: 'course_id', onDelete: 'CASCADE' });
    }
};
