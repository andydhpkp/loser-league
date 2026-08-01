const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/connection");

class OfficialGameResultOverride extends Model {}

OfficialGameResultOverride.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  league_season_id: { type: DataTypes.INTEGER, allowNull: false },
  week: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 22 } },
  matchup_key: { type: DataTypes.STRING(255), allowNull: false },
  home_team: { type: DataTypes.STRING, allowNull: false },
  away_team: { type: DataTypes.STRING, allowNull: false },
  home_score: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  away_score: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  winner_team: { type: DataTypes.STRING, allowNull: true },
  loser_team: { type: DataTypes.STRING, allowNull: true },
  tied: { type: DataTypes.BOOLEAN, allowNull: false },
  schedule_hash: { type: DataTypes.STRING(64), allowNull: false, validate: { is: /^[a-f0-9]{64}$/i } },
  explanation: { type: DataTypes.STRING(500), allowNull: false },
  source_url: { type: DataTypes.STRING(2048), allowNull: true },
  admin_audit_operation_id: { type: DataTypes.INTEGER, allowNull: false },
}, {
  sequelize,
  freezeTableName: true,
  underscored: true,
  modelName: "official_game_result_override",
  updatedAt: false,
  indexes: [{ unique: true, fields: ["league_season_id", "week", "matchup_key"] }],
});

module.exports = OfficialGameResultOverride;
