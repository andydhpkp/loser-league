"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const user = await queryInterface.describeTable("user");
    if (user.user_record) {
      return;
    }
    await queryInterface.addColumn("user", "user_record", {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: [],
      comment:
        "Array of objects tracking league wins by year: [{year: 2025, won: true, won_with_tie: false}]",
    });
  },

  down: async (queryInterface, Sequelize) => {
    throw new Error("Migration is forward-only");
  },
};
