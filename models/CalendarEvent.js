const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/connection");

class CalendarEvent extends Model {}
CalendarEvent.init({
  id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, primaryKey: true, autoIncrement: true },
  league_season_id: { type: DataTypes.INTEGER, allowNull: false },
  season_year: { type: DataTypes.INTEGER, allowNull: false },
  schedule_phase: { type: DataTypes.STRING(16), allowNull: false },
  round: { type: DataTypes.INTEGER, allowNull: false },
  event_uid: { type: DataTypes.STRING(191), allowNull: false },
  deadline: { type: DataTypes.DATE, allowNull: false },
  status: { type: DataTypes.STRING(16), allowNull: false },
  sequence: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  source_hash: { type: DataTypes.CHAR(64), allowNull: false },
  first_published_at: { type: DataTypes.DATE, allowNull: false },
  last_published_at: { type: DataTypes.DATE, allowNull: false },
  cancelled_at: { type: DataTypes.DATE, allowNull: true },
}, { sequelize, timestamps: false, freezeTableName: true, underscored: true, modelName: "calendar_event", indexes: [
  { unique: true, fields: ["season_year", "schedule_phase", "round"] },
  { unique: true, fields: ["event_uid"] },
] });
module.exports = CalendarEvent;
