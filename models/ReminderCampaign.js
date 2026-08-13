const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/connection");
class ReminderCampaign extends Model {}
ReminderCampaign.init({
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  league_season_id: { type: DataTypes.INTEGER, allowNull: false },
  schedule_phase: { type: DataTypes.STRING(16), allowNull: false },
  round: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  kind: { type: DataTypes.STRING(16), allowNull: false },
  window_key: { type: DataTypes.STRING(32), allowNull: false },
  authoritative_deadline: { type: DataTypes.DATE, allowNull: false },
  state: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "OPEN" },
  evaluated_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  eligible_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  admin_audit_operation_id: { type: DataTypes.INTEGER, allowNull: true },
}, { sequelize, freezeTableName: true, underscored: true, modelName: "reminder_campaign", indexes: [{ unique: true, fields: ["league_season_id", "schedule_phase", "round", "kind", "window_key"] }] });
module.exports = ReminderCampaign;
