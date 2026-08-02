"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addIndex("track_reactivation", ["admin_audit_operation_id"], { name: "track_reactivation_audit_operation" });
    await queryInterface.removeIndex("track_reactivation", "admin_audit_operation_id");
    await queryInterface.createTable("buyback_decision", {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "user", key: "id" }, onDelete: "CASCADE" },
      league_season_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "league_season", key: "id" }, onDelete: "CASCADE" },
      status: { type: Sequelize.ENUM("ELIGIBLE", "PENDING_USER_REQUEST", "DECLINED_USER", "COMPLETED_USER_REQUEST", "COMPLETED_ADMIN_DIRECT", "CANCELLED_ADMIN", "EXPIRED_DEADLINE", "CLOSED_BY_PICK"), allowNull: false },
      origin: { type: Sequelize.ENUM("SYSTEM", "USER", "ADMIN", "PICK", "DEADLINE"), allowNull: false },
      unit_price_cents: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1000 },
      state_version: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      requested_at: { type: Sequelize.DATE, allowNull: true },
      resolved_at: { type: Sequelize.DATE, allowNull: true },
      admin_audit_operation_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: "admin_audit_operation", key: "id" } },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex("buyback_decision", ["user_id", "league_season_id"], { unique: true, name: "buyback_decision_user_season_unique" });
    await queryInterface.createTable("buyback_decision_track", {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      buyback_decision_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "buyback_decision", key: "id" }, onDelete: "CASCADE" },
      track_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "track", key: "id" }, onDelete: "CASCADE" },
      week_one_pick_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "pick", key: "id" }, onDelete: "CASCADE" },
      resolution: { type: Sequelize.ENUM("PENDING", "FULFILLED", "UNFULFILLED"), allowNull: false },
      track_reactivation_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: "track_reactivation", key: "id" }, onDelete: "SET NULL" },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex("buyback_decision_track", ["buyback_decision_id", "track_id"], { unique: true, name: "buyback_decision_track_unique" });
    await queryInterface.addIndex("buyback_decision_track", ["week_one_pick_id"], { unique: true, name: "buyback_decision_week_one_pick_unique" });
  },
  async down() { throw new Error("Week 2 buyback migration is forward-only"); },
};
