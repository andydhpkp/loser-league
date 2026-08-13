const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/connection");
class UserFeatureAccessState extends Model {}
UserFeatureAccessState.init({
  user_id: { type: DataTypes.INTEGER, primaryKey: true },
  feature_key: { type: DataTypes.STRING(64), primaryKey: true },
  access_removed_at: { type: DataTypes.DATE, allowNull: true },
  grace_expires_at: { type: DataTypes.DATE, allowNull: true },
}, { sequelize, freezeTableName: true, underscored: true, modelName: "user_feature_access_state" });
module.exports = UserFeatureAccessState;
