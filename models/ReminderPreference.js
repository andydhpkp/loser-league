const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/connection");
class ReminderPreference extends Model {}
ReminderPreference.init({
  user_id: { type: DataTypes.INTEGER, primaryKey: true },
  email_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  push_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  state_version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
}, { sequelize, freezeTableName: true, underscored: true, modelName: "reminder_preference" });
module.exports = ReminderPreference;
