const test = require("node:test");

const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  test("forward database migrations", { skip: "TEST_DATABASE_URL is not set" }, () => {});
} else {
  process.env.NODE_ENV = "test";

  const assert = require("node:assert/strict");
  const sequelize = require("../../config/connection");
  const {
    migrateEmptyTestDatabase,
  } = require("../support/migrate-test-database");

  test.after(async () => {
    await sequelize.close();
  });

  test("forward migrations create the lifecycle foundation and allow only one open League Season", async () => {
    await migrateEmptyTestDatabase(sequelize);
    const queryInterface = sequelize.getQueryInterface();

    const tables = new Set(await queryInterface.showAllTables());
    for (const table of [
      "user",
      "team",
      "track",
      "Sessions",
      "league_season",
      "pick",
      "schedule_snapshot",
      "league_week_operation",
    ]) {
      assert.equal(tables.has(table), true, `missing ${table}`);
    }

    await queryInterface.bulkInsert("league_season", [
      {
        year: 2026,
        state: "SETUP",
        current_week: 0,
        state_version: 0,
        open_slot: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
    await assert.rejects(
      queryInterface.bulkInsert("league_season", [
        {
          year: 2027,
          state: "ACTIVE",
          current_week: 1,
          state_version: 0,
          open_slot: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ])
    );
  });
}
