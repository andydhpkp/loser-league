const fs = require("node:fs");
const path = require("node:path");
const Sequelize = require("sequelize");

async function migrateEmptyTestDatabase(sequelize) {
  const queryInterface = sequelize.getQueryInterface();
  await queryInterface.dropAllTables();
  const migrationsDirectory = path.join(__dirname, "../../migrations");
  const migrationFiles = fs
    .readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".js"))
    .sort();

  for (const migrationFile of migrationFiles) {
    const migration = require(path.join(migrationsDirectory, migrationFile));
    await migration.up(queryInterface, Sequelize);
  }
}

module.exports = { migrateEmptyTestDatabase };
