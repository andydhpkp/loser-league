const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/connection");
class PushSubscription extends Model {}
PushSubscription.init({
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false }, endpoint_digest: { type: DataTypes.CHAR(64), allowNull: false },
  ciphertext: { type: DataTypes.TEXT("long"), allowNull: false }, nonce: { type: DataTypes.STRING(24), allowNull: false }, authentication_tag: { type: DataTypes.STRING(32), allowNull: false }, key_version: { type: DataTypes.STRING(32), allowNull: false },
  state: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "ACTIVE" }, invalidated_at: { type: DataTypes.DATE, allowNull: true },
}, { sequelize, freezeTableName: true, underscored: true, modelName: "push_subscription", indexes: [{ unique: true, fields: ["endpoint_digest"] }, { fields: ["user_id", "state"] }] });
module.exports = PushSubscription;
