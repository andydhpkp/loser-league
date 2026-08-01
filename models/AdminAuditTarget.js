const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/connection");

class AdminAuditTarget extends Model {}
AdminAuditTarget.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  admin_audit_operation_id: { type: DataTypes.INTEGER, allowNull: false },
  target_type: { type: DataTypes.ENUM("USER", "TRACK", "PICK", "LEAGUE_SEASON"), allowNull: false },
  target_id: { type: DataTypes.INTEGER, allowNull: false },
  before_state: { type: DataTypes.JSON, allowNull: true },
  after_state: { type: DataTypes.JSON, allowNull: true },
  state_version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { sequelize, freezeTableName: true, underscored: true, modelName: "admin_audit_target", updatedAt: false });
module.exports = AdminAuditTarget;
