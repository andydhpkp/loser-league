"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const db = queryInterface.sequelize;
    const tables = await queryInterface.showAllTables();
    const exists = tables.includes("league_pot_exemption");
    if (exists) {
      const saved = await db.query("SELECT user_id FROM league_pot_exemption", { type: Sequelize.QueryTypes.SELECT });
      if (saved.length === 1) return; // Preserve the ID even after a rename.
      if (saved.length > 1) throw new Error("Ambiguous League pot exemption configuration");
    }
    const matches = await db.query("SELECT id FROM user WHERE LOWER(username) = :username", {
      replacements: { username: "andydhpkp" }, type: Sequelize.QueryTypes.SELECT,
    });
    const [population] = await db.query("SELECT COUNT(*) AS total FROM user", { type: Sequelize.QueryTypes.SELECT });
    if (matches.length > 1 || (Number(population.total) > 0 && matches.length !== 1)) {
      throw new Error("Cannot uniquely configure the approved League pot exemption");
    }
    if (!exists) await queryInterface.createTable("league_pot_exemption", {
      user_id: { type: Sequelize.INTEGER, primaryKey: true, allowNull: false,
        references: { model: "user", key: "id" }, onDelete: "CASCADE" },
    });
    if (matches.length === 1) await queryInterface.bulkInsert("league_pot_exemption", [{ user_id: matches[0].id }]);
  },
  async down() { throw new Error("League pot exemption migration is forward-only"); },
};
