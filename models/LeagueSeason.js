const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/connection");

const LEAGUE_SEASON_STATES = Object.freeze([
  "SETUP",
  "ACTIVE",
  "COMPLETE",
  "ROLLED_OVER",
]);

class LeagueSeason extends Model {}

LeagueSeason.init(
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      validate: { min: 1000, max: 9999 },
    },
    state: {
      type: DataTypes.ENUM(...LEAGUE_SEASON_STATES),
      allowNull: false,
      validate: { isIn: [LEAGUE_SEASON_STATES] },
    },
    current_week: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 0, max: 22 },
    },
    schedule_phase: {
      type: DataTypes.ENUM("REGULAR", "PRESEASON"),
      allowNull: false,
      defaultValue: "REGULAR",
      validate: { isIn: [["REGULAR", "PRESEASON"]] },
    },
    preseason_complete: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    late_week_one_enrollment: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    pick_cycle: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
      validate: { isIn: [[1, 2]] },
    },
    state_version: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    open_slot: {
      type: DataTypes.TINYINT,
      allowNull: true,
      unique: true,
      validate: { isIn: [[1]] },
    },
  },
  {
    sequelize,
    freezeTableName: true,
    underscored: true,
    modelName: "league_season",
    validate: {
      stateMatchesWeek() {
        if (this.state === "SETUP" && this.current_week !== 0) {
          throw new Error("League Season setup is restricted to Week 0");
        }
        if (this.state === "ACTIVE" && this.current_week < 1) {
          throw new Error("League Season active week must be at least 1");
        }
        const shouldBeOpen = this.state === "SETUP" || this.state === "ACTIVE";
        if (
          (shouldBeOpen && this.open_slot !== 1) ||
          (!shouldBeOpen && this.open_slot !== null)
        ) {
          throw new Error("League Season open slot does not match its state");
        }
      },
    },
  }
);

module.exports = LeagueSeason;
module.exports.LEAGUE_SEASON_STATES = LEAGUE_SEASON_STATES;
