const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/connection");
class ReminderDelivery extends Model {}
ReminderDelivery.init({
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  reminder_campaign_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  channel: { type: DataTypes.STRING(8), allowNull: false },
  state: { type: DataTypes.STRING(24), allowNull: false, defaultValue: "PENDING" },
  attempt_count: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
  claimed_count: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
  temporary_failure_count: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
  claim_version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  claimed_until: { type: DataTypes.DATE, allowNull: true },
  next_attempt_at: { type: DataTypes.DATE, allowNull: true },
  last_attempt_at: { type: DataTypes.DATE, allowNull: true },
  consumed_at: { type: DataTypes.DATE, allowNull: true },
  suppression_reason: { type: DataTypes.STRING(32), allowNull: true },
}, { sequelize, freezeTableName: true, underscored: true, modelName: "reminder_delivery", indexes: [{ unique: true, fields: ["reminder_campaign_id", "user_id", "channel"] }] });
module.exports = ReminderDelivery;
