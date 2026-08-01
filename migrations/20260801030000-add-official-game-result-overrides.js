"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("official_game_result_override", {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      league_season_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "league_season", key: "id" }, onDelete: "CASCADE" },
      week: { type: Sequelize.INTEGER, allowNull: false },
      matchup_key: { type: Sequelize.STRING(255), allowNull: false },
      home_team: { type: Sequelize.STRING, allowNull: false },
      away_team: { type: Sequelize.STRING, allowNull: false },
      home_score: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      away_score: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      winner_team: { type: Sequelize.STRING, allowNull: true },
      loser_team: { type: Sequelize.STRING, allowNull: true },
      tied: { type: Sequelize.BOOLEAN, allowNull: false },
      schedule_hash: { type: Sequelize.STRING(64), allowNull: false },
      explanation: { type: Sequelize.STRING(500), allowNull: false },
      source_url: { type: Sequelize.STRING(2048), allowNull: true },
      admin_audit_operation_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "admin_audit_operation", key: "id" } },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex(
      "official_game_result_override",
      ["league_season_id", "week", "matchup_key"],
      { name: "official_result_override_matchup_unique", unique: true }
    );
  },

  async down() {
    throw new Error("Official game result override migration is forward-only");
  },
};
