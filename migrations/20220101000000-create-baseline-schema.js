"use strict";

async function hasTable(queryInterface, tableName) {
  return (await queryInterface.showAllTables()).includes(tableName);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await hasTable(queryInterface, "user"))) {
      await queryInterface.createTable("user", {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        first_name: { type: Sequelize.STRING, allowNull: false },
        last_name: { type: Sequelize.STRING, allowNull: false },
        username: { type: Sequelize.STRING, allowNull: false },
        email: { type: Sequelize.STRING, allowNull: false, unique: true },
        password: { type: Sequelize.STRING, allowNull: false },
      });
    }

    if (!(await hasTable(queryInterface, "team"))) {
      await queryInterface.createTable("team", {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        team_name: { type: Sequelize.STRING, allowNull: false },
        team_logo: { type: Sequelize.TEXT, allowNull: true },
        team_record: { type: Sequelize.STRING, allowNull: true },
      });
    }

    if (!(await hasTable(queryInterface, "track"))) {
      await queryInterface.createTable("track", {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        available_picks: { type: Sequelize.TEXT, allowNull: false },
        used_picks: { type: Sequelize.TEXT, allowNull: true },
        current_pick: { type: Sequelize.STRING, allowNull: true },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "user", key: "id" },
        },
      });
    }

    if (!(await hasTable(queryInterface, "Sessions"))) {
      await queryInterface.createTable("Sessions", {
        sid: { type: Sequelize.STRING(36), primaryKey: true },
        expires: { type: Sequelize.DATE, allowNull: true },
        data: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }
  },

  async down() {
    throw new Error("Baseline migration is forward-only");
  },
};
