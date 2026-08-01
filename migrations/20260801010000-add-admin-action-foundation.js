"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("admin_audit_operation", {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      action: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.STRING, allowNull: false },
      note: { type: Sequelize.STRING(500), allowNull: true },
      status: { type: Sequelize.ENUM("COMMITTED", "UNDONE"), allowNull: false },
      league_season_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: "league_season", key: "id" } },
      week: { type: Sequelize.INTEGER, allowNull: true },
      summary: { type: Sequelize.JSON, allowNull: false },
      undoable: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      undone_by_operation_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: "admin_audit_operation", key: "id" } },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("admin_action_preview", {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      confirmation_key_hash: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      action: { type: Sequelize.STRING, allowNull: false },
      normalized_intent: { type: Sequelize.JSON, allowNull: false },
      preview: { type: Sequelize.JSON, allowNull: false },
      league_season_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: "league_season", key: "id" } },
      week: { type: Sequelize.INTEGER, allowNull: true },
      league_season_state_version: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
      schedule_hash: { type: Sequelize.STRING(64), allowNull: true },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      consumed_at: { type: Sequelize.DATE, allowNull: true },
      audit_operation_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: "admin_audit_operation", key: "id" } },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("admin_audit_target", {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      admin_audit_operation_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "admin_audit_operation", key: "id" }, onDelete: "CASCADE" },
      target_type: { type: Sequelize.ENUM("USER", "TRACK", "PICK", "LEAGUE_SEASON"), allowNull: false },
      target_id: { type: Sequelize.INTEGER, allowNull: false },
      before_state: { type: Sequelize.JSON, allowNull: true },
      after_state: { type: Sequelize.JSON, allowNull: true },
      state_version: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex("admin_audit_target", ["target_type", "target_id", "admin_audit_operation_id"], { name: "admin_audit_target_lookup" });
  },

  async down() {
    throw new Error("Admin action foundation migration is forward-only");
  },
};
