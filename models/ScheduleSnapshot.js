const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/connection");

class ScheduleSnapshot extends Model {}

ScheduleSnapshot.init(
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
      validate: { min: 1, max: 22 },
    },
    provider: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true },
    },
    content_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      validate: { is: /^[a-f0-9]{64}$/i },
    },
    normalized_schedule: { type: DataTypes.JSON, allowNull: false },
    fetched_at: { type: DataTypes.DATE, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    timestamps: false,
    freezeTableName: true,
    underscored: true,
    modelName: "schedule_snapshot",
    indexes: [
      {
        unique: true,
        fields: [
          "league_season_id",
          "week",
          "provider",
          "content_hash",
        ],
      },
    ],
  }
);

module.exports = ScheduleSnapshot;
