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
      "admin_action_preview",
      "admin_audit_operation",
      "admin_audit_target",
      "official_game_result_override",
    ]) {
      assert.equal(tables.has(table), true, `missing ${table}`);
    }

    const preview = await queryInterface.describeTable("admin_action_preview");
    assert.ok(preview.confirmation_key_hash);
    assert.ok(preview.schedule_hash);
    assert.equal(preview.actor_id, undefined);

    const audit = await queryInterface.describeTable("admin_audit_operation");
    assert.equal(audit.actor_id, undefined);
    const pick = await queryInterface.describeTable("pick");
    assert.ok(pick.schedule_hash);
    const resultOverride = await queryInterface.describeTable("official_game_result_override");
    assert.ok(resultOverride.matchup_key);
    assert.ok(resultOverride.schedule_hash);
    assert.ok(resultOverride.explanation);
    assert.ok(resultOverride.source_url);
    assert.ok(resultOverride.admin_audit_operation_id);
    assert.equal(resultOverride.actor_id, undefined);

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
