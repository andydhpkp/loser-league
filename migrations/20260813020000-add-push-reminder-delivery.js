"use strict";
module.exports = { async up(queryInterface, Sequelize) {
  await queryInterface.createTable("push_subscription", {
    id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, autoIncrement: true, primaryKey: true }, user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "user", key: "id" }, onDelete: "CASCADE" }, endpoint_digest: { type: Sequelize.CHAR(64), allowNull: false }, ciphertext: { type: Sequelize.TEXT("long"), allowNull: false }, nonce: { type: Sequelize.STRING(24), allowNull: false }, authentication_tag: { type: Sequelize.STRING(32), allowNull: false }, key_version: { type: Sequelize.STRING(32), allowNull: false }, state: { type: Sequelize.STRING(16), allowNull: false, defaultValue: "ACTIVE" }, invalidated_at: { type: Sequelize.DATE, allowNull: true }, created_at: { type: Sequelize.DATE, allowNull: false }, updated_at: { type: Sequelize.DATE, allowNull: false },
  });
  await queryInterface.addConstraint("push_subscription", { fields: ["endpoint_digest"], type: "unique", name: "push_subscription_endpoint_digest_uq" });
  await queryInterface.addIndex("push_subscription", ["user_id", "state"], { name: "push_subscription_user_state_idx" });
  await queryInterface.createTable("push_device_delivery", {
    id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, autoIncrement: true, primaryKey: true }, reminder_delivery_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, references: { model: "reminder_delivery", key: "id" }, onDelete: "CASCADE" }, push_subscription_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, references: { model: "push_subscription", key: "id" }, onDelete: "CASCADE" }, state: { type: Sequelize.STRING(24), allowNull: false, defaultValue: "PENDING" }, attempt_count: { type: Sequelize.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 }, claim_version: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 }, claimed_until: { type: Sequelize.DATE, allowNull: true }, consumed_at: { type: Sequelize.DATE, allowNull: true }, created_at: { type: Sequelize.DATE, allowNull: false }, updated_at: { type: Sequelize.DATE, allowNull: false },
  });
  await queryInterface.addConstraint("push_device_delivery", { fields: ["reminder_delivery_id", "push_subscription_id"], type: "unique", name: "push_device_delivery_identity_uq" });
  await queryInterface.addIndex("push_device_delivery", ["state", "claimed_until"], { name: "push_device_delivery_claim_idx" });
}, async down() { throw new Error("Push reminder delivery migration is forward-only"); } };
