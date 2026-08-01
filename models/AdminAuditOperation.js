const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/connection");

class AdminAuditOperation extends Model {}
AdminAuditOperation.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  action: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.STRING, allowNull: false },
  note: { type: DataTypes.STRING(500), allowNull: true },
  status: { type: DataTypes.ENUM("COMMITTED", "UNDONE"), allowNull: false },
  league_season_id: { type: DataTypes.INTEGER, allowNull: true },
  week: { type: DataTypes.INTEGER, allowNull: true },
  summary: { type: DataTypes.JSON, allowNull: false },
  undoable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  undone_by_operation_id: { type: DataTypes.INTEGER, allowNull: true },
}, { sequelize, freezeTableName: true, underscored: true, modelName: "admin_audit_operation", updatedAt: false });
module.exports = AdminAuditOperation;
