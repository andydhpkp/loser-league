const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/connection");

const LEAGUE_WEEK_PHASES = Object.freeze([
  "START_SEASON",
  "AUTO_PICK",
  "CLOSE_WEEK",
]);

class LeagueWeekOperation extends Model {}

LeagueWeekOperation.init(
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    league_season_id: { type: DataTypes.INTEGER, allowNull: false },
    week: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 0, max: 22 },
    },
    phase: {
      type: DataTypes.ENUM(...LEAGUE_WEEK_PHASES),
      allowNull: false,
      validate: { isIn: [LEAGUE_WEEK_PHASES] },
    },
    mode: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true },
    },
    schedule_hash: {
      type: DataTypes.STRING(64),
      allowNull: true,
      validate: { is: /^[a-f0-9]{64}$/i },
    },
    summary: { type: DataTypes.JSON, allowNull: false },
    completed_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    timestamps: false,
    freezeTableName: true,
    underscored: true,
    modelName: "league_week_operation",
    indexes: [
      {
        unique: true,
        fields: ["league_season_id", "week", "phase"],
      },
    ],
  }
);

module.exports = LeagueWeekOperation;
module.exports.LEAGUE_WEEK_PHASES = LEAGUE_WEEK_PHASES;
