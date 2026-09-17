const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/connection");
class LeaguePotAdjustment extends Model {}
LeaguePotAdjustment.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  league_season_id: { type: DataTypes.INTEGER, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  track_id: { type: DataTypes.INTEGER, allowNull: false },
  admin_audit_operation_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  amount_cents: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  explanation: { type: DataTypes.STRING(500), allowNull: false },
}, { sequelize, modelName: "league_pot_adjustment", freezeTableName: true, underscored: true, updatedAt: false });
module.exports = LeaguePotAdjustment;
