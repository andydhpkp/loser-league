const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/connection");

class CalendarFeedState extends Model {}
CalendarFeedState.init({
  id: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, primaryKey: true },
  content: { type: DataTypes.TEXT("long"), allowNull: false },
  content_hash: { type: DataTypes.CHAR(64), allowNull: false },
  last_modified_at: { type: DataTypes.DATE, allowNull: false },
  last_trustworthy_refresh_at: { type: DataTypes.DATE, allowNull: false },
  state_version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
}, { sequelize, timestamps: false, freezeTableName: true, underscored: true, modelName: "calendar_feed_state" });
module.exports = CalendarFeedState;
