"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("reminder_preference", {
      user_id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, references: { model: "user", key: "id" }, onDelete: "CASCADE" },
      email_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      push_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      state_version: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.createTable("reminder_campaign", {
      id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, autoIncrement: true, primaryKey: true },
      league_season_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "league_season", key: "id" } },
      schedule_phase: { type: Sequelize.STRING(16), allowNull: false },
      round: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      kind: { type: Sequelize.STRING(16), allowNull: false },
      window_key: { type: Sequelize.STRING(32), allowNull: false },
      authoritative_deadline: { type: Sequelize.DATE, allowNull: false },
      state: { type: Sequelize.STRING(16), allowNull: false, defaultValue: "OPEN" },
      evaluated_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      eligible_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      admin_audit_operation_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: "admin_audit_operation", key: "id" } },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addConstraint("reminder_campaign", { fields: ["league_season_id", "schedule_phase", "round", "kind", "window_key"], type: "unique", name: "reminder_campaign_round_kind_window_uq" });
    await queryInterface.createTable("reminder_delivery", {
      id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, autoIncrement: true, primaryKey: true },
      reminder_campaign_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, references: { model: "reminder_campaign", key: "id" }, onDelete: "CASCADE" },
      user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "user", key: "id" }, onDelete: "CASCADE" },
      channel: { type: Sequelize.STRING(8), allowNull: false },
      state: { type: Sequelize.STRING(24), allowNull: false, defaultValue: "PENDING" },
      attempt_count: { type: Sequelize.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      claimed_count: { type: Sequelize.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      temporary_failure_count: { type: Sequelize.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      claim_version: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      claimed_until: { type: Sequelize.DATE, allowNull: true },
      next_attempt_at: { type: Sequelize.DATE, allowNull: true },
      last_attempt_at: { type: Sequelize.DATE, allowNull: true },
      consumed_at: { type: Sequelize.DATE, allowNull: true },
      suppression_reason: { type: Sequelize.STRING(32), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addConstraint("reminder_delivery", { fields: ["reminder_campaign_id", "user_id", "channel"], type: "unique", name: "reminder_delivery_campaign_user_channel_uq" });
    await queryInterface.addIndex("reminder_delivery", ["state", "next_attempt_at", "claimed_until"], { name: "reminder_delivery_claim_idx" });
  },
  async down() { throw new Error("Pick reminder foundation migration is forward-only"); },
};
