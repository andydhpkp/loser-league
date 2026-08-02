const test = require("node:test");
const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  test("bulk Track creation", { skip: "TEST_DATABASE_URL is not set" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  const assert = require("node:assert/strict");
  const { sequelize, LeagueSeason, Team, Track, User } = require("../../models");
  const { createTracksInBulk } = require("../../server/admin/bulk-track-service");
  const { migrateEmptyTestDatabase } = require("../support/migrate-test-database");

  test.beforeEach(async () => {
    await migrateEmptyTestDatabase(sequelize);
    await LeagueSeason.create({ year: 2026, state: "SETUP", current_week: 0, state_version: 0, open_slot: 1 });
    await Team.bulkCreate([{ team_name: "Broncos", team_record: [0, 0] }, { team_name: "Raiders", team_record: [0, 0] }]);
  });
  test.after(async () => sequelize.close());

  test("creates a multi-User batch atomically with current-season Pick pools", async () => {
    const alice = await User.create({ first_name: "Alice", last_name: "Able", username: "alice-bulk", email: "alice-bulk@example.test", password: "safe-test-password" });
    const bob = await User.create({ first_name: "Bob", last_name: "Baker", username: "bob-bulk", email: "bob-bulk@example.test", password: "safe-test-password" });

    const result = await createTracksInBulk([{ userId: alice.id, quantity: 2 }, { userId: bob.id, quantity: 3 }]);

    assert.equal(result.totalCreated, 5);
    assert.equal(await Track.count({ where: { user_id: alice.id } }), 2);
    assert.equal(await Track.count({ where: { user_id: bob.id } }), 3);
    const tracks = await Track.findAll();
    assert.ok(tracks.every((track) => track.league_season_id && track.available_picks.includes("Broncos") && track.available_picks.includes("Raiders")));
  });

  test("creates none when any selected User is stale", async () => {
    const user = await User.create({ first_name: "Valid", last_name: "User", username: "valid-bulk", email: "valid-bulk@example.test", password: "safe-test-password" });
    await assert.rejects(createTracksInBulk([{ userId: user.id, quantity: 2 }, { userId: 999999, quantity: 1 }]), /no longer exist/);
    assert.equal(await Track.count(), 0);
  });
}
