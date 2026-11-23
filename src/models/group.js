const { Model, DataTypes } = require('sequelize');
const { primaryId, required } = require('./attributes');

module.exports = class Group extends Model {
    static init(sequelize) {
        return super.init(
            {
                id: primaryId(),
                name: { ...required(DataTypes.STRING(80)), unique: true },
            },
            {
                sequelize,
                modelName: 'student_groups',
                tableName: 'student_groups',
                timestamps: false,
                freezeTableName: true,
            },
        );
    }

    static associate(db) {
        this.hasMany(db.GroupMember, {
            as: 'memberships',
            foreignKey: 'group_id',
            onDelete: 'CASCADE',
        });
    }
};
