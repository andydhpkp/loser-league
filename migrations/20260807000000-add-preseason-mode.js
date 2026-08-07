"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("league_season", "schedule_phase", {
      type: Sequelize.ENUM("REGULAR", "PRESEASON"), allowNull: false, defaultValue: "REGULAR",
    });
    await queryInterface.addColumn("league_season", "preseason_complete", {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
    });
    await queryInterface.addColumn("league_season", "late_week_one_enrollment", {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
    });
  },

  async down() {
    throw new Error("Preseason mode migration is forward-only");
  },
};
