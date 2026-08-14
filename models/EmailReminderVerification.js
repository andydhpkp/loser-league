const { Model, DataTypes } = require("sequelize"); const sequelize = require("../config/connection");
class EmailReminderVerification extends Model {}
EmailReminderVerification.init({ user_id: { type: DataTypes.INTEGER, primaryKey: true }, email_digest: { type: DataTypes.CHAR(64), allowNull: false }, key_version: { type: DataTypes.STRING(32), allowNull: false }, verified_at: { type: DataTypes.DATE, allowNull: false }, security_version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 }, state_version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 } }, { sequelize, freezeTableName: true, underscored: true, modelName: "email_reminder_verification" });
module.exports = EmailReminderVerification;
