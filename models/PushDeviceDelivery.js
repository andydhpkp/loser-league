const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/connection");
class PushDeviceDelivery extends Model {}
PushDeviceDelivery.init({
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true }, reminder_delivery_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false }, push_subscription_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  state: { type: DataTypes.STRING(24), allowNull: false, defaultValue: "PENDING" }, attempt_count: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 }, claim_version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 }, claimed_until: { type: DataTypes.DATE, allowNull: true }, consumed_at: { type: DataTypes.DATE, allowNull: true },
}, { sequelize, freezeTableName: true, underscored: true, modelName: "push_device_delivery", indexes: [{ unique: true, fields: ["reminder_delivery_id", "push_subscription_id"] }] });
module.exports = PushDeviceDelivery;
