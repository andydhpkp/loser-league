const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/connection");

class AdminActionPreview extends Model {}
AdminActionPreview.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  confirmation_key_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  action: { type: DataTypes.STRING, allowNull: false },
  normalized_intent: { type: DataTypes.JSON, allowNull: false },
  preview: { type: DataTypes.JSON, allowNull: false },
  league_season_id: { type: DataTypes.INTEGER, allowNull: true },
  week: { type: DataTypes.INTEGER, allowNull: true },
  league_season_state_version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  schedule_hash: { type: DataTypes.STRING(64), allowNull: true },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  consumed_at: { type: DataTypes.DATE, allowNull: true },
  audit_operation_id: { type: DataTypes.INTEGER, allowNull: true },
}, { sequelize, freezeTableName: true, underscored: true, modelName: "admin_action_preview", updatedAt: false });
module.exports = AdminActionPreview;
