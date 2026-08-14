"use strict";
module.exports = { async up(queryInterface, Sequelize) {
  await queryInterface.createTable("calendar_event", {
    id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, autoIncrement: true, primaryKey: true },
    league_season_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "league_season", key: "id" } },
    season_year: { type: Sequelize.INTEGER, allowNull: false },
    schedule_phase: { type: Sequelize.STRING(16), allowNull: false },
    round: { type: Sequelize.INTEGER, allowNull: false },
    event_uid: { type: Sequelize.STRING(191), allowNull: false },
    deadline: { type: Sequelize.DATE, allowNull: false },
    status: { type: Sequelize.STRING(16), allowNull: false },
    sequence: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    source_hash: { type: Sequelize.CHAR(64), allowNull: false },
    first_published_at: { type: Sequelize.DATE, allowNull: false },
    last_published_at: { type: Sequelize.DATE, allowNull: false },
    cancelled_at: { type: Sequelize.DATE, allowNull: true },
  });
  await queryInterface.addConstraint("calendar_event", { fields: ["season_year", "schedule_phase", "round"], type: "unique", name: "calendar_event_identity_uq" });
  await queryInterface.addConstraint("calendar_event", { fields: ["event_uid"], type: "unique", name: "calendar_event_uid_uq" });
  await queryInterface.addIndex("calendar_event", ["deadline", "status"], { name: "calendar_event_retention_idx" });
  await queryInterface.createTable("calendar_feed_state", {
    id: { type: Sequelize.TINYINT.UNSIGNED, allowNull: false, primaryKey: true },
    content: { type: Sequelize.TEXT("long"), allowNull: false },
    content_hash: { type: Sequelize.CHAR(64), allowNull: false },
    last_modified_at: { type: Sequelize.DATE, allowNull: false },
    last_trustworthy_refresh_at: { type: Sequelize.DATE, allowNull: false },
    state_version: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  });
}, async down() { throw new Error("Pick deadline calendar migration is forward-only"); } };
