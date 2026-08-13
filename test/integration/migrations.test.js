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
      "feature_release",
      "user_feature_entitlement",
      "user_feature_access_state",
      "feature_admin_audit_target",
      "reminder_preference",
      "reminder_campaign",
      "reminder_delivery",
      "admin_audit_operation",
      "admin_audit_target",
      "official_game_result_override",
      "track_reactivation",
      "buyback_decision",
      "buyback_decision_track",
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
    assert.ok(pick.pick_cycle);
    const season = await queryInterface.describeTable("league_season");
    assert.ok(season.pick_cycle);
    assert.ok(season.schedule_phase);
    assert.ok(season.preseason_complete);
    assert.ok(season.late_week_one_enrollment);
    const reactivation = await queryInterface.describeTable("track_reactivation");
    assert.ok(reactivation.waived_pick_id);
    assert.ok(reactivation.admin_audit_operation_id);
    const decision = await queryInterface.describeTable("buyback_decision");
    assert.ok(decision.state_version);
    assert.ok(decision.unit_price_cents);
    const decisionTrack = await queryInterface.describeTable("buyback_decision_track");
    assert.ok(decisionTrack.week_one_pick_id);
    assert.ok(decisionTrack.track_reactivation_id);
    const resultOverride = await queryInterface.describeTable("official_game_result_override");
    assert.ok(resultOverride.matchup_key);
    assert.ok(resultOverride.schedule_hash);
    assert.ok(resultOverride.explanation);
    assert.ok(resultOverride.source_url);
    assert.ok(resultOverride.admin_audit_operation_id);
    assert.equal(resultOverride.actor_id, undefined);
    const preference = await queryInterface.describeTable("reminder_preference");
    assert.equal(String(preference.email_enabled.defaultValue), "0");
    assert.equal(String(preference.push_enabled.defaultValue), "0");
    const delivery = await queryInterface.describeTable("reminder_delivery");
    assert.ok(delivery.claimed_count);
    assert.ok(delivery.temporary_failure_count);
    assert.equal(delivery.destination, undefined);
    assert.equal(delivery.message_body, undefined);
    const campaign = await queryInterface.describeTable("reminder_campaign");
    assert.ok(campaign.evaluated_count);
    assert.ok(campaign.eligible_count);

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
