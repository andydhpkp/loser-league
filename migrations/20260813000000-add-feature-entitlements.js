"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("feature_release", {
      feature_key: { type: Sequelize.STRING(64), primaryKey: true, allowNull: false },
      public_released: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      state_version: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.createTable("user_feature_entitlement", {
      user_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, references: { model: "user", key: "id" }, onDelete: "CASCADE" },
      feature_key: { type: Sequelize.STRING(64), primaryKey: true, allowNull: false, references: { model: "feature_release", key: "feature_key" } },
      enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      state_version: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.createTable("user_feature_access_state", {
      user_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false, references: { model: "user", key: "id" }, onDelete: "CASCADE" },
      feature_key: { type: Sequelize.STRING(64), primaryKey: true, allowNull: false, references: { model: "feature_release", key: "feature_key" } },
      access_removed_at: { type: Sequelize.DATE, allowNull: false },
      grace_expires_at: { type: Sequelize.DATE, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.createTable("feature_admin_audit_target", {
      id: { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true, primaryKey: true },
      admin_audit_operation_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "admin_audit_operation", key: "id" }, onDelete: "CASCADE" },
      feature_key: { type: Sequelize.STRING(64), allowNull: false, references: { model: "feature_release", key: "feature_key" } },
      before_state: { type: Sequelize.JSON, allowNull: false },
      after_state: { type: Sequelize.JSON, allowNull: false },
      state_version: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.bulkInsert("feature_release", [{ feature_key: "PICK_REMINDERS", public_released: false, state_version: 0, created_at: new Date(), updated_at: new Date() }]);
  },
  async down() { throw new Error("Feature entitlement migration is forward-only"); },
};
