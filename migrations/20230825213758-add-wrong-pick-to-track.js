"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const track = await queryInterface.describeTable("track");
    if (track.wrong_pick) {
      return;
    }
    await queryInterface.addColumn("track", "wrong_pick", {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    });
  },

  down: async (queryInterface, Sequelize) => {
    throw new Error("Migration is forward-only");
  },
};
