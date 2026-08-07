const test = require("node:test");
const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  test("atomic Pick submission", { skip: "TEST_DATABASE_URL is not set" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  const assert = require("node:assert/strict");
  const { sequelize, User, Track, LeagueSeason, Pick, ScheduleSnapshot } = require("../../models");
  const { submitPicks } = require("../../server/modules/picks/submission-service");
  const { executeAutoPick } = require("../../server/modules/picks/auto-pick-service");
  const { getLeagueView, getSubmissionState } = require("../../server/modules/picks/league-service");
  const { migrateEmptyTestDatabase } = require("../support/migrate-test-database");

  test.beforeEach(async () => migrateEmptyTestDatabase(sequelize));
  test.after(async () => sequelize.close());

  test("complete submission commits normalized Picks and legacy projections exactly once", async () => {
    const season = await LeagueSeason.create({ year: 2026, state: "ACTIVE", current_week: 1, state_version: 4, open_slot: 1 });
    const user = await User.create({ first_name: "Pick", last_name: "User", username: "picker", email: "picker@example.test", password: "safe-test-password" });
    const tracks = await Track.bulkCreate([
      { user_id: user.id, league_season_id: season.id, available_picks: ["Broncos", "Raiders"], used_picks: [], current_pick: null, wrong_pick: null, state_version: 0 },
      { user_id: user.id, league_season_id: season.id, available_picks: ["Broncos", "Raiders"], used_picks: [], current_pick: null, wrong_pick: null, state_version: 0 },
    ]);
    const schedule = { year: 2026, week: 1, provider: "FIXTURE_DOWNLOAD", contentHash: "a".repeat(64), teams: ["Broncos", "Raiders"], earliestKickoff: new Date("2026-09-10T00:00:00Z"), normalizedSchedule: { teams: ["Broncos", "Raiders"] }, fetchedAt: new Date("2026-09-01T00:00:00Z") };
    const selections = [{ trackId: tracks[0].id, stateVersion: 0, teamName: "Broncos" }, { trackId: tracks[1].id, stateVersion: 0, teamName: "Raiders" }];

    const first = await submitPicks({ userId: user.id, selections, schedule, now: new Date("2026-09-01T00:00:01Z") });
    const replay = await submitPicks({ userId: user.id, selections, schedule, now: new Date("2026-09-01T00:00:02Z") });

    assert.equal(first.picks.length, 2);
    assert.equal(replay.idempotent, true);
    await assert.rejects(
      submitPicks({
        userId: user.id,
        selections: [{ ...selections[0], teamName: "Raiders" }, selections[1]],
        schedule,
        now: new Date("2026-09-01T00:00:03Z"),
      }),
      /locked/
    );
    assert.equal(await Pick.count(), 2);
    const refreshed = await Track.findByPk(tracks[0].id);
    assert.equal(refreshed.current_pick, "Broncos");
    assert.deepEqual(refreshed.used_picks, ["Broncos"]);
  });

  test("submission rolls back normalized Picks and projections after a mid-write failure", async (t) => {
    const season = await LeagueSeason.create({ year: 2026, state: "ACTIVE", current_week: 1, state_version: 1, open_slot: 1 });
    const user = await User.create({ first_name: "Rollback", last_name: "User", username: "rollback", email: "rollback@example.test", password: "safe-test-password" });
    const tracks = await Track.bulkCreate([
      { user_id: user.id, league_season_id: season.id, available_picks: ["Broncos", "Raiders"], used_picks: [], current_pick: null, wrong_pick: null, state_version: 0 },
      { user_id: user.id, league_season_id: season.id, available_picks: ["Broncos", "Raiders"], used_picks: [], current_pick: null, wrong_pick: null, state_version: 0 },
    ]);
    const schedule = { year: 2026, week: 1, provider: "FIXTURE_DOWNLOAD", contentHash: "b".repeat(64), teams: ["Broncos", "Raiders"], earliestKickoff: new Date("2026-09-10T00:00:00Z"), normalizedSchedule: { teams: ["Broncos", "Raiders"] }, fetchedAt: new Date("2026-09-01T00:00:00Z") };
    const originalCreate = Pick.create.bind(Pick);
    let writes = 0;
    t.mock.method(Pick, "create", async (...args) => {
      writes += 1;
      if (writes === 2) throw new Error("injected Pick failure");
      return originalCreate(...args);
    });

    await assert.rejects(
      submitPicks({
        userId: user.id,
        selections: [
          { trackId: tracks[0].id, stateVersion: 0, teamName: "Broncos" },
          { trackId: tracks[1].id, stateVersion: 0, teamName: "Raiders" },
        ],
        schedule,
        now: new Date("2026-09-01T00:00:01Z"),
      }),
      /injected Pick failure/
    );

    assert.equal(await Pick.count(), 0);
    const refreshed = await Track.findAll({ where: { user_id: user.id }, order: [["id", "ASC"]] });
    assert.deepEqual(refreshed.map((track) => track.current_pick), [null, null]);
    assert.deepEqual(refreshed.map((track) => track.used_picks), [[], []]);
  });

  test("competing submissions commit at most one selection set", async () => {
    const season = await LeagueSeason.create({ year: 2026, state: "ACTIVE", current_week: 1, state_version: 1, open_slot: 1 });
    const user = await User.create({ first_name: "Concurrent", last_name: "User", username: "concurrent", email: "concurrent@example.test", password: "safe-test-password" });
    const track = await Track.create({ user_id: user.id, league_season_id: season.id, available_picks: ["Broncos", "Raiders"], used_picks: [], current_pick: null, wrong_pick: null, state_version: 0 });
    const schedule = { year: 2026, week: 1, provider: "FIXTURE_DOWNLOAD", contentHash: "c".repeat(64), teams: ["Broncos", "Raiders"], earliestKickoff: new Date("2026-09-10T00:00:00Z"), normalizedSchedule: { teams: ["Broncos", "Raiders"] }, fetchedAt: new Date("2026-09-01T00:00:00Z") };

    const outcomes = await Promise.allSettled([
      submitPicks({ userId: user.id, selections: [{ trackId: track.id, stateVersion: 0, teamName: "Broncos" }], schedule, now: new Date("2026-09-01T00:00:01Z") }),
      submitPicks({ userId: user.id, selections: [{ trackId: track.id, stateVersion: 0, teamName: "Raiders" }], schedule, now: new Date("2026-09-01T00:00:01Z") }),
    ]);

    assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
    assert.equal(outcomes.filter((outcome) => outcome.status === "rejected").length, 1);
    assert.equal(await Pick.count(), 1);
  });

  test("submission waiting for the League Season lock rechecks the deadline before commit", async () => {
    const season = await LeagueSeason.create({ year: 2026, state: "ACTIVE", current_week: 1, state_version: 1, open_slot: 1 });
    const user = await User.create({ first_name: "Deadline", last_name: "User", username: "deadline", email: "deadline@example.test", password: "safe-test-password" });
    const track = await Track.create({ user_id: user.id, league_season_id: season.id, available_picks: ["Broncos", "Raiders"], used_picks: [], current_pick: null, wrong_pick: null, state_version: 0 });
    const deadline = new Date("2026-09-10T00:00:00Z");
    const schedule = { year: 2026, week: 1, provider: "FIXTURE_DOWNLOAD", contentHash: "f".repeat(64), teams: ["Broncos", "Raiders"], earliestKickoff: deadline, normalizedSchedule: { week: 1, games: [] }, fetchedAt: new Date("2026-09-01T00:00:00Z") };
    const times = [new Date(deadline.getTime() - 1), deadline];

    await assert.rejects(
      submitPicks({ userId: user.id, selections: [{ trackId: track.id, stateVersion: 0, teamName: "Broncos" }], schedule, now: () => times.shift() }),
      /closed/
    );
    assert.equal(await Pick.count(), 0);
  });

  test("zero-Track onboarding is current-season authoritative and eliminated Tracks suppress it", async () => {
    const season = await LeagueSeason.create({ year: 2026, state: "ACTIVE", current_week: 1, state_version: 1, open_slot: 1 });
    const emptyUser = await User.create({ first_name: "Empty", last_name: "User", username: "empty", email: "empty@example.test", password: "safe-test-password" });
    const eliminatedUser = await User.create({ first_name: "Eliminated", last_name: "User", username: "eliminated", email: "eliminated@example.test", password: "safe-test-password" });
    const eliminated = await Track.create({ user_id: eliminatedUser.id, league_season_id: season.id, available_picks: ["Raiders"], used_picks: ["Broncos"], current_pick: null, wrong_pick: "Broncos", state_version: 1 });
    const wrongPick = await Pick.create({ track_id: eliminated.id, league_season_id: season.id, week: 1, team_name: "Broncos", origin: "USER_SUBMISSION", outcome: "WRONG_PICK", committed_at: new Date(), state_version: 0 });
    await eliminated.update({ eliminated_by_pick_id: wrongPick.id });
    await ScheduleSnapshot.create({ league_season_id: season.id, week: 1, provider: "FIXTURE_DOWNLOAD", content_hash: "7".repeat(64), normalized_schedule: { week: 1, games: [{ kickoff: "2026-09-10T00:00:00.000Z", homeTeam: "Broncos", awayTeam: "Raiders" }] }, fetched_at: new Date(), created_at: new Date() });
    const presentation = { price: "$5", contacts: [], payment: null };

    const empty = await getSubmissionState({ userId: emptyUser.id, now: new Date("2026-09-09T23:59:59Z"), onboardingPresentation: presentation });
    assert.deepEqual(empty.onboarding, { ...presentation, enrollmentOpen: true });
    assert.deepEqual(empty.tracks, []);

    const afterKickoff = await getSubmissionState({ userId: emptyUser.id, now: new Date("2026-09-10T00:00:00Z"), onboardingPresentation: presentation });
    assert.equal(afterKickoff.onboarding.enrollmentOpen, false);
    assert.equal(afterKickoff.onboarding.payment, null);

    const owned = await getSubmissionState({ userId: eliminatedUser.id, onboardingPresentation: presentation });
    assert.equal("onboarding" in owned, false);
    assert.deepEqual(owned.tracks, []);
  });

  test("league view rejects without disclosing current Picks until the viewing User is complete", async () => {
    const season = await LeagueSeason.create({ year: 2026, state: "ACTIVE", current_week: 1, state_version: 1, open_slot: 1 });
    const viewer = await User.create({ first_name: "Hidden", last_name: "Viewer", username: "viewer", email: "viewer@example.test", password: "safe-test-password" });
    const other = await User.create({ first_name: "Other", last_name: "User", username: "other", email: "other@example.test", password: "safe-test-password" });
    await Track.create({ user_id: viewer.id, league_season_id: season.id, available_picks: ["Broncos"], used_picks: [], current_pick: null, wrong_pick: null, state_version: 0 });
    const otherTrack = await Track.create({ user_id: other.id, league_season_id: season.id, available_picks: [], used_picks: ["Raiders"], current_pick: "Raiders", wrong_pick: null, state_version: 1 });
    await Pick.create({ track_id: otherTrack.id, league_season_id: season.id, week: 1, team_name: "Raiders", origin: "USER_SUBMISSION", outcome: "PENDING", committed_at: new Date(), state_version: 0 });

    await assert.rejects(
      getLeagueView({ userId: viewer.id }),
      (error) => error.code === "CONFLICT" && error.message === "Submit Picks for all active Tracks before viewing the League."
    );
  });

  test("auto-pick independently fills missing active Tracks and records one durable completion", async () => {
    const { LeagueWeekOperation } = require("../../models");
    const season = await LeagueSeason.create({ year: 2026, state: "ACTIVE", current_week: 1, state_version: 1, open_slot: 1 });
    const user = await User.create({ first_name: "Automatic", last_name: "User", username: "automatic", email: "automatic@example.test", password: "safe-test-password" });
    const tracks = await Track.bulkCreate([
      { user_id: user.id, league_season_id: season.id, available_picks: ["Broncos", "Chargers", "Chiefs", "Raiders"], used_picks: [], current_pick: null, wrong_pick: null, state_version: 0 },
      { user_id: user.id, league_season_id: season.id, available_picks: ["Broncos", "Chargers", "Chiefs", "Raiders"], used_picks: [], current_pick: null, wrong_pick: null, state_version: 0 },
    ]);
    const schedule = { year: 2026, week: 1, provider: "FIXTURE_DOWNLOAD", contentHash: "d".repeat(64), teams: ["Broncos", "Chargers", "Chiefs", "Raiders"], earliestKickoff: new Date("2026-09-10T00:00:00Z"), normalizedSchedule: { week: 1, games: [{ kickoff: "2026-09-10T00:00:00.000Z", homeTeam: "Broncos", awayTeam: "Raiders" }, { kickoff: "2026-09-11T00:00:00.000Z", homeTeam: "Chargers", awayTeam: "Chiefs" }] }, fetchedAt: new Date("2026-09-01T00:00:00Z") };
    const indices = [1, 0];

    const first = await executeAutoPick({ schedule, now: new Date("2026-09-10T00:00:00Z"), randomIndex: () => indices.shift() });
    const replay = await executeAutoPick({ schedule, now: new Date("2026-09-10T00:00:01Z"), randomIndex: () => { throw new Error("must not draw again"); } });

    assert.equal(first.status, "COMPLETED");
    assert.equal(replay.status, "ALREADY_COMPLETED");
    assert.equal(await LeagueWeekOperation.count({ where: { phase: "AUTO_PICK" } }), 1);
    const picks = await Pick.findAll({ order: [["track_id", "ASC"]] });
    assert.deepEqual(picks.map((pick) => [pick.track_id, pick.team_name, pick.origin]), [
      [tracks[0].id, "Chargers", "AUTOMATIC_SELECTION"],
      [tracks[1].id, "Broncos", "AUTOMATIC_SELECTION"],
    ]);
    const state = await getSubmissionState({ userId: user.id, now: new Date("2026-09-10T00:00:01Z") });
    assert.equal(state.deadline, "2026-09-10T00:00:00.000Z");
    assert.equal(state.submissionOpen, false);
    assert.equal(state.autoPickStatus, "COMPLETED");
  });

  test("normal submission and auto-pick commit in the active playoff Pick cycle", async () => {
    const season = await LeagueSeason.create({ year: 2026, state: "ACTIVE", current_week: 19, pick_cycle: 2, state_version: 9, open_slot: 1 });
    const submittingUser = await User.create({ first_name: "Playoff", last_name: "Submitter", username: "playoff-submit", email: "playoff-submit@example.test", password: "safe-test-password" });
    const automaticUser = await User.create({ first_name: "Playoff", last_name: "Automatic", username: "playoff-auto", email: "playoff-auto@example.test", password: "safe-test-password" });
    const submittingTrack = await Track.create({ user_id: submittingUser.id, league_season_id: season.id, available_picks: ["Broncos", "Raiders"], used_picks: [], current_pick: null, wrong_pick: null, state_version: 1 });
    const automaticTrack = await Track.create({ user_id: automaticUser.id, league_season_id: season.id, available_picks: ["Broncos", "Raiders"], used_picks: [], current_pick: null, wrong_pick: null, state_version: 1 });
    await Pick.bulkCreate([
      { track_id: submittingTrack.id, league_season_id: season.id, week: 1, pick_cycle: 1, team_name: "Broncos", origin: "USER_SUBMISSION", outcome: "PREDICTION_CORRECT", committed_at: new Date(), state_version: 0 },
      { track_id: automaticTrack.id, league_season_id: season.id, week: 1, pick_cycle: 1, team_name: "Broncos", origin: "AUTOMATIC_SELECTION", outcome: "PREDICTION_CORRECT", committed_at: new Date(), state_version: 0 },
    ]);
    const schedule = { year: 2026, week: 19, provider: "FIXTURE_DOWNLOAD", contentHash: "9".repeat(64), teams: ["Broncos", "Raiders"], earliestKickoff: new Date("2027-01-10T00:00:00Z"), normalizedSchedule: { week: 19, games: [] }, fetchedAt: new Date("2027-01-01T00:00:00Z") };

    await submitPicks({ userId: submittingUser.id, selections: [{ trackId: submittingTrack.id, stateVersion: 1, teamName: "Broncos" }], schedule, now: new Date("2027-01-02T00:00:00Z") });
    await executeAutoPick({ schedule, now: new Date("2027-01-10T00:00:00Z"), randomIndex: () => 0 });

    const cycleTwo = await Pick.findAll({ where: { league_season_id: season.id, pick_cycle: 2 }, order: [["track_id", "ASC"]] });
    assert.deepEqual(cycleTwo.map((pick) => [pick.track_id, pick.team_name, pick.pick_cycle]), [
      [submittingTrack.id, "Broncos", 2],
      [automaticTrack.id, "Broncos", 2],
    ]);
  });

  test("concurrent auto-pick evaluators converge on one Pick and one completion", async () => {
    const { LeagueWeekOperation } = require("../../models");
    const season = await LeagueSeason.create({ year: 2026, state: "ACTIVE", current_week: 1, state_version: 1, open_slot: 1 });
    const user = await User.create({ first_name: "Concurrent", last_name: "Automatic", username: "concurrent-auto", email: "concurrent-auto@example.test", password: "safe-test-password" });
    await Track.create({ user_id: user.id, league_season_id: season.id, available_picks: ["Broncos", "Raiders"], used_picks: [], current_pick: null, wrong_pick: null, state_version: 0 });
    const schedule = { year: 2026, week: 1, provider: "FIXTURE_DOWNLOAD", contentHash: "e".repeat(64), teams: ["Broncos", "Raiders"], earliestKickoff: new Date("2026-09-10T00:00:00Z"), normalizedSchedule: { week: 1, games: [] }, fetchedAt: new Date("2026-09-01T00:00:00Z") };

    const results = await Promise.all([
      executeAutoPick({ schedule, now: new Date("2026-09-10T00:00:00Z"), randomIndex: () => 0 }),
      executeAutoPick({ schedule, now: new Date("2026-09-10T00:00:00Z"), randomIndex: () => 1 }),
    ]);

    assert.deepEqual(results.map((result) => result.status).sort(), ["ALREADY_COMPLETED", "COMPLETED"]);
    assert.equal(await Pick.count(), 1);
    assert.equal(await LeagueWeekOperation.count({ where: { phase: "AUTO_PICK" } }), 1);
  });

  test("auto-pick rolls back every Pick, projection, and completion after a mid-write failure", async (t) => {
    const { LeagueWeekOperation } = require("../../models");
    const season = await LeagueSeason.create({ year: 2026, state: "ACTIVE", current_week: 1, state_version: 1, open_slot: 1 });
    const user = await User.create({ first_name: "Rollback", last_name: "Automatic", username: "rollback-auto", email: "rollback-auto@example.test", password: "safe-test-password" });
    const tracks = await Track.bulkCreate([
      { user_id: user.id, league_season_id: season.id, available_picks: ["Broncos", "Raiders"], used_picks: [], current_pick: null, wrong_pick: null, state_version: 0 },
      { user_id: user.id, league_season_id: season.id, available_picks: ["Broncos", "Raiders"], used_picks: [], current_pick: null, wrong_pick: null, state_version: 0 },
    ]);
    const schedule = { year: 2026, week: 1, provider: "FIXTURE_DOWNLOAD", contentHash: "1".repeat(64), teams: ["Broncos", "Raiders"], earliestKickoff: new Date("2026-09-10T00:00:00Z"), normalizedSchedule: { week: 1, games: [] }, fetchedAt: new Date("2026-09-01T00:00:00Z") };
    const originalCreate = Pick.create.bind(Pick);
    let writes = 0;
    t.mock.method(Pick, "create", async (...args) => {
      writes += 1;
      if (writes === 2) throw new Error("injected automatic Pick failure");
      return originalCreate(...args);
    });

    await assert.rejects(executeAutoPick({ schedule, now: new Date("2026-09-10T00:00:00Z"), randomIndex: () => 0 }), /injected automatic Pick failure/);

    assert.equal(await Pick.count(), 0);
    assert.equal(await LeagueWeekOperation.count({ where: { phase: "AUTO_PICK" } }), 0);
    const refreshed = await Track.findAll({ where: { user_id: user.id }, order: [["id", "ASC"]] });
    assert.deepEqual(refreshed.map((track) => [track.current_pick, track.used_picks]), [[null, []], [null, []]]);
    assert.deepEqual(refreshed.map((track) => track.id), tracks.map((track) => track.id));
  });
}
