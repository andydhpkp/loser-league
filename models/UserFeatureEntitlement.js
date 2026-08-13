const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/connection");
class UserFeatureEntitlement extends Model {}
UserFeatureEntitlement.init({
  user_id: { type: DataTypes.INTEGER, primaryKey: true },
  feature_key: { type: DataTypes.STRING(64), primaryKey: true },
  enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  state_version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
}, { sequelize, freezeTableName: true, underscored: true, modelName: "user_feature_entitlement" });
module.exports = UserFeatureEntitlement;
