const { DataTypes } = require('sequelize');

const primaryId = () => ({
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
});
const required = (type) => ({ type, allowNull: false });
const createdAt = () => ({ type: DataTypes.DATE, defaultValue: DataTypes.NOW });

module.exports = { primaryId, required, createdAt };
