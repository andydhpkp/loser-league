module.exports = {
  async up(queryInterface, Sequelize) {
    for (const [table, column] of [["pick", "voided_by_operation_id"], ["track_reactivation", "reversed_by_operation_id"], ["buyback_decision_track", "reversed_by_operation_id"]]) {
      await queryInterface.addColumn(table, column, { type: Sequelize.INTEGER, allowNull: true, references: { model: "admin_audit_operation", key: "id" }, onDelete: "RESTRICT" });
    }
    await queryInterface.createTable("league_pot_adjustment", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      league_season_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: "league_season", key: "id" }, onDelete: "RESTRICT" },
      user_id: { type: Sequelize.INTEGER, allowNull: false },
      track_id: { type: Sequelize.INTEGER, allowNull: false },
      admin_audit_operation_id: { type: Sequelize.INTEGER, allowNull: false, unique: true, references: { model: "admin_audit_operation", key: "id" }, onDelete: "RESTRICT" },
      amount_cents: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      explanation: { type: Sequelize.STRING(500), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex("league_pot_adjustment", ["league_season_id", "user_id"]);
  },
  async down() { throw new Error("Track corrections are forward-only; use a forward fix"); },
};
