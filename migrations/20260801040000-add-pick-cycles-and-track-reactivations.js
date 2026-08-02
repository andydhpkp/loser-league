"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("league_season", "pick_cycle", {
      type: Sequelize.TINYINT.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
    });
    await queryInterface.addColumn("pick", "pick_cycle", {
      type: Sequelize.TINYINT.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
    });
    await queryInterface.removeIndex("pick", "pick_track_season_team_unique");
    await queryInterface.addIndex(
      "pick",
      ["track_id", "league_season_id", "pick_cycle", "team_name"],
      { unique: true, name: "pick_track_season_cycle_team_unique" }
    );
    await queryInterface.createTable("track_reactivation", {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      track_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "track", key: "id" }, onDelete: "CASCADE" },
      league_season_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "league_season", key: "id" } },
      waived_pick_id: { type: Sequelize.INTEGER, allowNull: false, unique: true, references: { model: "pick", key: "id" } },
      admin_audit_operation_id: { type: Sequelize.INTEGER, allowNull: false, unique: true, references: { model: "admin_audit_operation", key: "id" } },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down() {
    throw new Error("Pick cycle and Track reactivation migration is forward-only");
  },
};
