const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/connection");
class FeatureRelease extends Model {}
FeatureRelease.init({
  feature_key: { type: DataTypes.STRING(64), primaryKey: true },
  public_released: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  state_version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
}, { sequelize, freezeTableName: true, underscored: true, modelName: "feature_release" });
module.exports = FeatureRelease;
