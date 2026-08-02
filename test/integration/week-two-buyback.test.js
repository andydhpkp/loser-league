const test = require("node:test");
const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  test("Week 2 buyback workflow", { skip: "TEST_DATABASE_URL is not set" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  const assert = require("node:assert/strict");
  const { sequelize, User, Track, LeagueSeason, Pick, ScheduleSnapshot, BuybackDecision, BuybackDecisionTrack, TrackReactivation } = require("../../models");
  const { getUserBuyback, decide, resolveAdmin, completeAdminDirect } = require("../../server/modules/buyback/buyback-service");
  const { submitPicks } = require("../../server/modules/picks/submission-service");
  const { executeAutoPick } = require("../../server/modules/picks/auto-pick-service");
  const { migrateEmptyTestDatabase } = require("../support/migrate-test-database");

  const deadline = new Date("2026-09-17T00:00:00Z");
  const before = new Date("2026-09-16T00:00:00Z");
  const schedule = { year: 2026, week: 2, provider: "FIXTURE_DOWNLOAD", contentHash: "b".repeat(64), teams: ["Broncos", "Raiders", "Chiefs", "Chargers"], earliestKickoff: deadline, normalizedSchedule: { week: 2, games: [{ kickoff: deadline.toISOString(), homeTeam: "Broncos", awayTeam: "Raiders" }, { kickoff: "2026-09-18T00:00:00.000Z", homeTeam: "Chiefs", awayTeam: "Chargers" }] }, fetchedAt: before };

  async function setup() {
    const season = await LeagueSeason.create({ year: 2026, state: "ACTIVE", current_week: 2, state_version: 2, open_slot: 1 });
    const user = await User.create({ first_name: "Buy", last_name: "Back", username: "buyback", email: "buyback@example.test", password: "safe-test-password" });
    const active = await Track.create({ user_id: user.id, league_season_id: season.id, available_picks: ["Broncos", "Raiders", "Chiefs", "Chargers"], used_picks: ["Jets"], current_pick: null, wrong_pick: null, state_version: 0 });
    await Pick.create({ track_id: active.id, league_season_id: season.id, week: 1, pick_cycle: 1, team_name: "Jets", origin: "USER_SUBMISSION", outcome: "PREDICTION_CORRECT", committed_at: before, state_version: 0 });
    const eliminated = [];
    for (const [index, team] of ["Bears", "Giants"].entries()) {
      const track = await Track.create({ user_id: user.id, league_season_id: season.id, available_picks: ["Broncos", "Raiders", "Chiefs", "Chargers"], used_picks: [team], current_pick: null, wrong_pick: team, state_version: 1 });
      const pick = await Pick.create({ track_id: track.id, league_season_id: season.id, week: 1, pick_cycle: 1, team_name: team, origin: "USER_SUBMISSION", outcome: "WRONG_PICK", committed_at: new Date(before.getTime() - index), state_version: 0 });
      await track.update({ eliminated_by_pick_id: pick.id });
      eliminated.push(track);
    }
    await ScheduleSnapshot.create({ league_season_id: season.id, week: 2, provider: schedule.provider, content_hash: schedule.contentHash, normalized_schedule: schedule.normalizedSchedule, fetched_at: before, created_at: before });
    return { season, user, active, eliminated };
  }

  test.beforeEach(async () => migrateEmptyTestDatabase(sequelize));
  test.after(async () => sequelize.close());

  test("eligible request is immutable, gates Picks, and partial admin fulfillment unlocks", async () => {
    const { user, active, eliminated } = await setup();
    const initial = await getUserBuyback({ userId: user.id, deadlineAvailable: true, now: before });
    assert.equal(initial.status, "ELIGIBLE");
    assert.deepEqual(initial.tracks.map((track) => track.trackId), eliminated.map((track) => track.id));
    const pending = await decide({ userId: user.id, action: "REQUEST", trackIds: eliminated.map((track) => track.id), stateVersion: initial.stateVersion, deadline, now: before });
    assert.equal(pending.status, "PENDING_USER_REQUEST");
    await assert.rejects(decide({ userId: user.id, action: "REQUEST", trackIds: [eliminated[0].id], stateVersion: initial.stateVersion, deadline, now: before }), /changed/i);
    await assert.rejects(submitPicks({ userId: user.id, selections: [{ trackId: active.id, stateVersion: active.state_version, teamName: "Broncos" }], schedule, now: before }), /buyback/i);
    const completed = await resolveAdmin({ decisionId: (await BuybackDecision.findOne()).id, stateVersion: pending.stateVersion, fulfilledTrackIds: [eliminated[0].id], paymentConfirmed: true, now: before });
    assert.equal(completed.status, "COMPLETED_USER_REQUEST");
    assert.equal(await TrackReactivation.count(), 1);
    const members = await BuybackDecisionTrack.findAll({ order: [["track_id", "ASC"]] });
    assert.deepEqual(members.map((row) => row.resolution), ["FULFILLED", "UNFULFILLED"]);
    const activeTracks = await Track.findAll({ where: { user_id: user.id, eliminated_by_pick_id: null }, order: [["id", "ASC"]] });
    await submitPicks({ userId: user.id, selections: activeTracks.map((track, index) => ({ trackId: track.id, stateVersion: track.state_version, teamName: index ? "Raiders" : "Broncos" })), schedule, now: before });
    assert.equal(await Pick.count({ where: { week: 2 } }), 2);
  });

  test("decline is durable and exact retry is idempotent", async () => {
    const { user } = await setup();
    const initial = await getUserBuyback({ userId: user.id, deadlineAvailable: true, now: before });
    const first = await decide({ userId: user.id, action: "DECLINE", stateVersion: initial.stateVersion, deadline, now: before });
    const retry = await decide({ userId: user.id, action: "DECLINE", stateVersion: initial.stateVersion, deadline, now: before });
    assert.equal(first.status, "DECLINED_USER");
    assert.equal(retry.idempotent, true);
    assert.equal(await BuybackDecision.count(), 1);
  });

  test("admin may cancel a request without reactivating any Track", async () => {
    const { user, eliminated } = await setup();
    const initial = await getUserBuyback({ userId: user.id, deadlineAvailable: true, deadline, now: before });
    const pending = await decide({ userId: user.id, action: "REQUEST", trackIds: [eliminated[0].id], stateVersion: initial.stateVersion, deadline, now: before });
    const cancelled = await resolveAdmin({ decisionId: (await BuybackDecision.findOne()).id, stateVersion: pending.stateVersion, cancel: true, now: before });
    assert.equal(cancelled.status, "CANCELLED_ADMIN");
    assert.equal(await TrackReactivation.count(), 0);
    assert.equal((await BuybackDecisionTrack.findOne()).resolution, "UNFULFILLED");
  });

  test("admin may directly complete an exact eligible subset and suppress the rest", async () => {
    const { user, eliminated } = await setup();
    const initial = await getUserBuyback({ userId: user.id, deadlineAvailable: true, deadline, now: before });
    const completed = await completeAdminDirect({ userId: user.id, trackIds: [eliminated[1].id], stateVersion: initial.stateVersion, paymentConfirmed: true, now: before });
    assert.equal(completed.status, "COMPLETED_ADMIN_DIRECT");
    assert.equal(await TrackReactivation.count(), 1);
    assert.equal((await BuybackDecision.findOne()).status, "COMPLETED_ADMIN_DIRECT");
  });

  test("deadline expires pending request before auto-picking only surviving Tracks", async () => {
    const { user, active, eliminated } = await setup();
    const initial = await getUserBuyback({ userId: user.id, deadlineAvailable: true, now: before });
    await decide({ userId: user.id, action: "REQUEST", trackIds: [eliminated[0].id], stateVersion: initial.stateVersion, deadline, now: before });
    const result = await executeAutoPick({ schedule, now: deadline, randomIndex: () => 0 });
    assert.equal(result.expiredBuybackCount, 1);
    assert.equal((await BuybackDecision.findOne()).status, "EXPIRED_DEADLINE");
    const weekTwo = await Pick.findAll({ where: { week: 2 } });
    assert.deepEqual(weekTwo.map((pick) => pick.track_id), [active.id]);
    assert.equal((await BuybackDecisionTrack.findOne()).resolution, "UNFULFILLED");
  });

  test("an existing Week 2 Pick reconciles the opportunity as closed by Pick", async () => {
    const { user, active } = await setup();
    await Pick.create({ track_id: active.id, league_season_id: active.league_season_id, week: 2, pick_cycle: 1, team_name: "Broncos", origin: "USER_SUBMISSION", outcome: "PENDING", committed_at: before, state_version: 0 });
    const view = await getUserBuyback({ userId: user.id, deadlineAvailable: true, deadline, now: before });
    assert.equal(view.status, "CLOSED_BY_PICK");
    assert.equal(view.pickBlocked, false);
  });
}
