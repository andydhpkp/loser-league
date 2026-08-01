const test = require("node:test");

const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  test("League Season bootstrap", { skip: "TEST_DATABASE_URL is not set" }, () => {});
} else {
  process.env.NODE_ENV = "test";

  const assert = require("node:assert/strict");
  const sequelize = require("../../config/connection");
  const { User, Track, LeagueSeason, Pick } = require("../../models/my-index");
  const {
    bootstrapLeagueSeason,
  } = require("../../server/modules/league-season/bootstrap");
  const {
    migrateEmptyTestDatabase,
  } = require("../support/migrate-test-database");

  test.beforeEach(async () => {
    await migrateEmptyTestDatabase(sequelize);
  });

  test.after(async () => {
    await sequelize.close();
  });

  test("bootstrap previews without writes, applies atomically, and replays as a no-op", async () => {
    const user = await User.create({
      first_name: "Test",
      last_name: "User",
      username: "bootstrap-user",
      email: "bootstrap@example.test",
      password: "safe-test-password",
    });
    const eliminatedTrack = await Track.create({
      user_id: user.id,
      available_picks: ["Bears"],
      used_picks: ["Broncos", "Raiders", "Jets"],
      current_pick: "Jets",
      wrong_pick: "Raiders",
    });
    const activeTrack = await Track.create({
      user_id: user.id,
      available_picks: ["Jets", "Bears"],
      used_picks: ["Broncos", "Raiders"],
      current_pick: null,
      wrong_pick: null,
    });

    const preview = await bootstrapLeagueSeason({
      year: 2026,
      state: "ACTIVE",
      week: 3,
      apply: false,
    });
    assert.deepEqual(preview, {
      applied: false,
      alreadyApplied: false,
      year: 2026,
      state: "ACTIVE",
      week: 3,
      trackCount: 2,
      pickCount: 5,
      eliminatedTrackCount: 1,
    });
    assert.equal(await LeagueSeason.count(), 0);
    assert.equal(await Pick.count(), 0);

    const applied = await bootstrapLeagueSeason({
      year: 2026,
      state: "ACTIVE",
      week: 3,
      apply: true,
    });
    assert.equal(applied.applied, true);
    assert.equal(applied.alreadyApplied, false);
    assert.equal(await LeagueSeason.count(), 1);
    assert.equal(await Pick.count(), 5);

    await eliminatedTrack.reload();
    await activeTrack.reload();
    assert.ok(eliminatedTrack.league_season_id);
    assert.equal(activeTrack.league_season_id, eliminatedTrack.league_season_id);
    assert.ok(eliminatedTrack.eliminated_by_pick_id);
    assert.equal(activeTrack.eliminated_by_pick_id, null);

    const replay = await bootstrapLeagueSeason({
      year: 2026,
      state: "ACTIVE",
      week: 3,
      apply: true,
    });
    assert.equal(replay.applied, false);
    assert.equal(replay.alreadyApplied, true);
    assert.equal(await LeagueSeason.count(), 1);
    assert.equal(await Pick.count(), 5);
  });

  test("bootstrap rolls back every write when Pick backfill fails", async (t) => {
    const user = await User.create({
      first_name: "Rollback",
      last_name: "Test",
      username: "bootstrap-rollback",
      email: "bootstrap-rollback@example.test",
      password: "safe-test-password",
    });
    const track = await Track.create({
      user_id: user.id,
      available_picks: ["Jets"],
      used_picks: ["Broncos", "Raiders"],
      current_pick: "Raiders",
      wrong_pick: null,
    });
    const originalCreate = Pick.create.bind(Pick);
    let createCount = 0;
    t.mock.method(Pick, "create", async (...args) => {
      createCount += 1;
      if (createCount === 2) {
        throw new Error("injected Pick backfill failure");
      }
      return originalCreate(...args);
    });

    await assert.rejects(
      bootstrapLeagueSeason({
        year: 2026,
        state: "ACTIVE",
        week: 2,
        apply: true,
      }),
      /injected Pick backfill failure/
    );

    assert.equal(await LeagueSeason.count(), 0);
    assert.equal(await Pick.count(), 0);
    await track.reload();
    assert.equal(track.league_season_id, null);
    assert.equal(track.eliminated_by_pick_id, null);
  });

  test("bootstrap preview rejects Tracks already associated with another League Season", async () => {
    const user = await User.create({
      first_name: "Conflict",
      last_name: "Test",
      username: "bootstrap-conflict",
      email: "bootstrap-conflict@example.test",
      password: "safe-test-password",
    });
    const priorSeason = await LeagueSeason.create({
      year: 2025,
      state: "COMPLETE",
      current_week: 18,
      state_version: 4,
      open_slot: null,
    });
    await Track.create({
      user_id: user.id,
      league_season_id: priorSeason.id,
      available_picks: ["Broncos"],
      used_picks: [],
      current_pick: null,
      wrong_pick: null,
    });

    await assert.rejects(
      bootstrapLeagueSeason({
        year: 2026,
        state: "SETUP",
        week: 0,
        apply: false,
      }),
      /already belongs to a League Season/
    );
    assert.equal(await LeagueSeason.count(), 1);
    assert.equal(await Pick.count(), 0);
  });

  test("bootstrap preserves a declared Week 1 buyback without re-eliminating the Track", async () => {
    const user = await User.create({
      first_name: "Buyback",
      last_name: "Test",
      username: "bootstrap-buyback",
      email: "bootstrap-buyback@example.test",
      password: "safe-test-password",
    });
    const track = await Track.create({
      user_id: user.id,
      available_picks: ["Bears"],
      used_picks: ["Broncos", "Raiders"],
      current_pick: "Raiders",
      wrong_pick: null,
    });

    await bootstrapLeagueSeason({
      year: 2026,
      state: "ACTIVE",
      week: 2,
      apply: true,
      weekOneBuybackTrackIds: [track.id],
    });

    const picks = await Pick.findAll({
      where: { track_id: track.id },
      order: [["week", "ASC"]],
    });
    assert.deepEqual(
      picks.map((pick) => [pick.week, pick.outcome]),
      [
        [1, "WRONG_PICK"],
        [2, "PENDING"],
      ]
    );
    await track.reload();
    assert.equal(track.eliminated_by_pick_id, null);
  });
}
