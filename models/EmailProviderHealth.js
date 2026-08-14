const { Model, DataTypes } = require("sequelize"); const sequelize = require("../config/connection");
class EmailProviderHealth extends Model {}
EmailProviderHealth.init({ provider_key: { type: DataTypes.STRING(16), primaryKey: true }, state: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "CLOSED" }, opened_at: { type: DataTypes.DATE, allowNull: true }, opened_credential_version: { type: DataTypes.STRING(32), allowNull: true }, state_version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 } }, { sequelize, freezeTableName: true, underscored: true, modelName: "email_provider_health" });
module.exports = EmailProviderHealth;
