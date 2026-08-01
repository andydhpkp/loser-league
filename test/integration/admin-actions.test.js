const test = require("node:test");
const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  test("admin action foundation", { skip: "TEST_DATABASE_URL is not set" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  const assert = require("node:assert/strict");
  const { sequelize, User, Team, Track, LeagueSeason, AdminActionPreview, AdminAuditOperation, AdminAuditTarget } = require("../../models");
  const { createPreview, confirmPreview, hashKey } = require("../../server/admin/action-service");
  const { migrateEmptyTestDatabase } = require("../support/migrate-test-database");

  test.beforeEach(async () => {
    await migrateEmptyTestDatabase(sequelize);
    await LeagueSeason.create({ year: 2026, state: "SETUP", current_week: 0, state_version: 0, open_slot: 1 });
    await Team.bulkCreate([{ team_name: "Broncos", team_record: [0, 0] }, { team_name: "Raiders", team_record: [0, 0] }]);
  });
  test.after(async () => sequelize.close());

  test("Track creation preview stores only a hash and confirmation commits audit exactly once", async () => {
    const user = await User.create({ first_name: "Admin", last_name: "Target", username: "target", email: "target@example.test", password: "safe-test-password" });
    const preview = await createPreview("CREATE_TRACK", { userId: user.id });
    assert.equal(preview.targets.length, 1);
    const stored = await AdminActionPreview.findOne();
    assert.equal(stored.confirmation_key_hash, hashKey(preview.confirmationKey));
    assert.equal(JSON.stringify(stored.toJSON()).includes(preview.confirmationKey), false);

    const operation = await confirmPreview("CREATE_TRACK", preview.confirmationKey, " enrollment ");
    assert.equal(operation.action, "CREATE_TRACK");
    assert.equal(operation.note, "enrollment");
    assert.equal(await Track.count(), 1);
    assert.equal(await AdminAuditOperation.count(), 1);
    assert.equal(await AdminAuditTarget.count(), 1);

    const replay = await confirmPreview("CREATE_TRACK", preview.confirmationKey);
    assert.equal(replay.id, operation.id);
    assert.equal(await Track.count(), 1);
    assert.equal(await AdminAuditOperation.count(), 1);
  });

  test("stale Track delete preview is rejected without audit or deletion", async () => {
    const user = await User.create({ first_name: "Stale", last_name: "Target", username: "stale", email: "stale@example.test", password: "safe-test-password" });
    const season = await LeagueSeason.findOne();
    const track = await Track.create({ user_id: user.id, league_season_id: season.id, available_picks: ["Broncos"], used_picks: [], current_pick: null, wrong_pick: null, state_version: 0 });
    const preview = await createPreview("DELETE_TRACK", { trackId: track.id });
    await track.update({ state_version: 1 });

    await assert.rejects(confirmPreview("DELETE_TRACK", preview.confirmationKey), /stale/);
    assert.equal(await Track.count(), 1);
    assert.equal(await AdminAuditOperation.count(), 0);
  });
}
