const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/connection");

class BuybackDecision extends Model {}
BuybackDecision.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  league_season_id: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.ENUM("ELIGIBLE", "PENDING_USER_REQUEST", "DECLINED_USER", "COMPLETED_USER_REQUEST", "COMPLETED_ADMIN_DIRECT", "CANCELLED_ADMIN", "EXPIRED_DEADLINE", "CLOSED_BY_PICK"), allowNull: false },
  origin: { type: DataTypes.ENUM("SYSTEM", "USER", "ADMIN", "PICK", "DEADLINE"), allowNull: false },
  unit_price_cents: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1000 },
  state_version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  requested_at: { type: DataTypes.DATE, allowNull: true },
  resolved_at: { type: DataTypes.DATE, allowNull: true },
  admin_audit_operation_id: { type: DataTypes.INTEGER, allowNull: true },
}, { sequelize, freezeTableName: true, underscored: true, modelName: "buyback_decision" });
module.exports = BuybackDecision;
