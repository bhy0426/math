const { Model, DataTypes } = require('sequelize');
const { primaryId, required, createdAt } = require('./attributes');

module.exports = class Lecture extends Model {
    static init(sequelize) {
        return super.init(
            {
                id: primaryId(),
                course_id: required(DataTypes.INTEGER.UNSIGNED),
                title: required(DataTypes.STRING(160)),
                description: required(DataTypes.TEXT),
                position: { ...required(DataTypes.INTEGER.UNSIGNED), defaultValue: 1 },
                is_published: { ...required(DataTypes.BOOLEAN), defaultValue: true },
                video_file: DataTypes.STRING(80),
                mime_type: DataTypes.STRING(80),
                video_status: { ...required(DataTypes.STRING(20)), defaultValue: 'NO_VIDEO' },
                hls_key: DataTypes.CHAR(36),
                created_at: createdAt(),
            },
            {
                sequelize,
                modelName: 'lectures',
                tableName: 'lectures',
                timestamps: false,
                freezeTableName: true,
            },
        );
    }

    static associate(db) {
        this.belongsTo(db.Course, { as: 'course', foreignKey: 'course_id', onDelete: 'CASCADE' });
        this.hasMany(db.LectureAccess, {
            as: 'access',
            foreignKey: 'lecture_id',
            onDelete: 'CASCADE',
        });
    }
};
