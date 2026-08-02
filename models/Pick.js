const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/connection");

const PICK_ORIGINS = Object.freeze([
  "USER_SUBMISSION",
  "AUTOMATIC_SELECTION",
  "SHARED_ADMIN_REPAIR",
  "LEGACY_BACKFILL",
]);
const PICK_OUTCOMES = Object.freeze([
  "PENDING",
  "PREDICTION_CORRECT",
  "WRONG_PICK",
]);

class Pick extends Model {}

Pick.init(
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    track_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "track", key: "id" },
    },
    league_season_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "league_season", key: "id" },
    },
    week: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 22 },
    },
    pick_cycle: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
      validate: { isIn: [[1, 2]] },
    },
    team_name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true },
    },
    origin: {
      type: DataTypes.ENUM(...PICK_ORIGINS),
      allowNull: false,
      validate: { isIn: [PICK_ORIGINS] },
    },
    outcome: {
      type: DataTypes.ENUM(...PICK_OUTCOMES),
      allowNull: false,
      defaultValue: "PENDING",
      validate: { isIn: [PICK_OUTCOMES] },
    },
    committed_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    schedule_hash: {
      type: DataTypes.STRING(64),
      allowNull: true,
      validate: { is: /^[a-f0-9]{64}$/i },
    },
    state_version: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
  },
  {
    sequelize,
    timestamps: false,
    freezeTableName: true,
    underscored: true,
    modelName: "pick",
    indexes: [
      { unique: true, fields: ["track_id", "league_season_id", "week"] },
      {
        unique: true,
        fields: ["track_id", "league_season_id", "pick_cycle", "team_name"],
      },
    ],
  }
);

module.exports = Pick;
module.exports.PICK_ORIGINS = PICK_ORIGINS;
module.exports.PICK_OUTCOMES = PICK_OUTCOMES;
