const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/connection");
class FeatureAdminAuditTarget extends Model {}
FeatureAdminAuditTarget.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  admin_audit_operation_id: { type: DataTypes.INTEGER, allowNull: false },
  feature_key: { type: DataTypes.STRING(64), allowNull: false },
  before_state: { type: DataTypes.JSON, allowNull: false },
  after_state: { type: DataTypes.JSON, allowNull: false },
  state_version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
}, { sequelize, freezeTableName: true, underscored: true, modelName: "feature_admin_audit_target", updatedAt: false });
module.exports = FeatureAdminAuditTarget;
