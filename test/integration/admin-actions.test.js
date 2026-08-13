const test = require("node:test");
const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  test("admin action foundation", { skip: "TEST_DATABASE_URL is not set" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  const assert = require("node:assert/strict");
  const { sequelize, User, Team, Track, Pick, ScheduleSnapshot, LeagueWeekOperation, LeagueSeason, OfficialGameResultOverride, AdminActionPreview, AdminAuditOperation, AdminAuditTarget, FeatureRelease, UserFeatureEntitlement, UserFeatureAccessState } = require("../../models");
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

  test("Pick Reminders beta and public release changes are stale-safe, audited, and establish grace", async () => {
    const user = await User.create({ first_name: "Beta", last_name: "User", username: "beta-user", email: "beta@example.test", password: "safe-test-password" });
    const grant = await createPreview("SET_PICK_REMINDERS_BETA_ACCESS", { userId: user.id, enabled: true });
    await confirmPreview("SET_PICK_REMINDERS_BETA_ACCESS", grant.confirmationKey);
    const entitlement = await UserFeatureEntitlement.findOne();
    assert.equal(entitlement.enabled, true);
    assert.equal(entitlement.state_version, 1);
    assert.equal(await UserFeatureAccessState.count(), 0);

    const remove = await createPreview("SET_PICK_REMINDERS_BETA_ACCESS", { userId: user.id, enabled: false });
    const operation = await confirmPreview("SET_PICK_REMINDERS_BETA_ACCESS", remove.confirmationKey);
    const grace = await UserFeatureAccessState.findOne();
    assert.equal(operation.action, "SET_PICK_REMINDERS_BETA_ACCESS");
    assert.equal(grace.grace_expires_at.getTime() - grace.access_removed_at.getTime(), 30 * 24 * 60 * 60 * 1000);

    const release = await createPreview("SET_PICK_REMINDERS_PUBLIC_RELEASE", { enabled: true });
    await FeatureRelease.increment("state_version", { where: { feature_key: "PICK_REMINDERS" } });
    await assert.rejects(confirmPreview("SET_PICK_REMINDERS_PUBLIC_RELEASE", release.confirmationKey), /stale/);
    assert.equal((await FeatureRelease.findByPk("PICK_REMINDERS")).public_released, false);
    assert.equal(await AdminAuditOperation.count({ where: { action: "SET_PICK_REMINDERS_BETA_ACCESS" } }), 2);
  });

  test("admin creates an explicit League Season at SETUP Week 0 through one-use preview", async () => {
    await LeagueSeason.destroy({ where: {} });
    const preview = await createPreview("CREATE_LEAGUE_SEASON", { year: 2027 });
    assert.match(preview.description, /2027.*Week 0/);
    const operation = await confirmPreview("CREATE_LEAGUE_SEASON", preview.confirmationKey);
    const season = await LeagueSeason.findOne({ where: { year: 2027 } });
    assert.deepEqual({ state: season.state, week: season.current_week, open: season.open_slot }, { state: "SETUP", week: 0, open: 1 });
    assert.equal(operation.league_season_id, season.id);
    assert.equal((await confirmPreview("CREATE_LEAGUE_SEASON", preview.confirmationKey)).id, operation.id);
    assert.equal(await LeagueSeason.count(), 1);
  });

  test("admin starts Week 1 only with current future schedule evidence", async () => {
    const season = await LeagueSeason.findOne();
    const loader = async ({ year, week }) => ({ year, week, provider: "FIXTURE_DOWNLOAD", contentHash: "c".repeat(64), earliestKickoff: "2026-09-10T00:00:00.000Z", normalizedSchedule: { week: 1, games: [{ kickoff: "2026-09-10T00:00:00.000Z", homeTeam: "Broncos", awayTeam: "Raiders" }] }, fetchedAt: new Date("2026-08-01T00:00:00.000Z") });
    const options = { loadRolloverTargetSchedule: loader, now: new Date("2026-09-09T00:00:00.000Z") };
    const preview = await createPreview("START_LEAGUE_SEASON", { year: 2026 }, options);
    assert.match(preview.description, /0 Users and 0 Tracks/);
    await confirmPreview("START_LEAGUE_SEASON", preview.confirmationKey, null, options);
    await season.reload();
    assert.deepEqual({ state: season.state, week: season.current_week, version: season.state_version }, { state: "ACTIVE", week: 1, version: 1 });
    assert.equal(await ScheduleSnapshot.count({ where: { league_season_id: season.id, week: 1 } }), 1);
  });

  test("admin cannot start Week 1 once its earliest kickoff has arrived", async () => {
    const loader = async ({ year, week }) => ({ year, week, contentHash: "d".repeat(64), earliestKickoff: "2026-09-10T00:00:00.000Z", normalizedSchedule: { week: 1, games: [{ kickoff: "2026-09-10T00:00:00.000Z", homeTeam: "Broncos", awayTeam: "Raiders" }] } });
    await assert.rejects(createPreview("START_LEAGUE_SEASON", { year: 2026 }, { loadRolloverTargetSchedule: loader, now: new Date("2026-09-10T00:00:00.000Z") }), /earliest kickoff/);
  });

  test("admin enables inferred preseason and deletes current gameplay transactionally", async () => {
    const season = await LeagueSeason.findOne();
    const user = await User.create({ first_name: "Pre", last_name: "Season", username: "preseason", email: "preseason@example.test", password: "safe-test-password" });
    await Track.create({ user_id: user.id, league_season_id: season.id, available_picks: ["Broncos"], used_picks: [], current_pick: null, wrong_pick: null, state_version: 0 });
    const options = {
      now: new Date("2026-08-05T00:00:00Z"),
      loadRolloverTargetSchedule: async ({ year, week }) => ({ year, week, contentHash: "1".repeat(64), earliestKickoff: new Date("2026-09-10T00:00:00Z"), normalizedSchedule: { week, games: [] } }),
      loadPreseasonWeeks: async () => [
        { week: 1, games: [{ completed: true }] },
        { week: 2, games: [{ completed: false }] },
      ],
    };
    const preview = await createPreview("ENABLE_PRESEASON", {}, options);
    assert.match(preview.description, /preseason Week 2/);
    await confirmPreview("ENABLE_PRESEASON", preview.confirmationKey, null, options);
    await season.reload();
    assert.deepEqual({ phase: season.schedule_phase, week: season.current_week, state: season.state }, { phase: "PRESEASON", week: 2, state: "ACTIVE" });
    assert.equal(await Track.count({ where: { league_season_id: season.id } }), 0);
    assert.equal(await AdminAuditOperation.count({ where: { action: "ENABLE_PRESEASON" } }), 1);
  });

  test("admin starts regular Week 1 late and retains the enrollment recovery flag", async () => {
    const season = await LeagueSeason.findOne();
    await season.update({ state: "ACTIVE", current_week: 3, schedule_phase: "PRESEASON", state_version: 1 });
    const user = await User.create({ first_name: "Temp", last_name: "Track", username: "temp-track", email: "temp-track@example.test", password: "safe-test-password" });
    await Track.create({ user_id: user.id, league_season_id: season.id, available_picks: ["Raiders"], used_picks: [], current_pick: null, wrong_pick: null, state_version: 0 });
    const options = {
      now: new Date("2026-09-11T00:00:00Z"),
      loadRolloverTargetSchedule: async ({ year, week }) => ({ year, week, provider: "FIXTURE_DOWNLOAD", contentHash: "2".repeat(64), earliestKickoff: new Date("2026-09-10T00:00:00Z"), normalizedSchedule: { week, games: [{ kickoff: "2026-09-10T00:00:00Z", homeTeam: "Broncos", awayTeam: "Raiders" }] }, fetchedAt: new Date() }),
    };
    const preview = await createPreview("START_REGULAR_SEASON", {}, options);
    await confirmPreview("START_REGULAR_SEASON", preview.confirmationKey, null, options);
    await season.reload();
    assert.deepEqual({ phase: season.schedule_phase, week: season.current_week, late: season.late_week_one_enrollment }, { phase: "REGULAR", week: 1, late: true });
    assert.equal(await Track.count({ where: { league_season_id: season.id } }), 0);
    assert.equal(await ScheduleSnapshot.count({ where: { league_season_id: season.id, week: 1 } }), 1);
  });

  test("Track creation defaults open without a Week 1 schedule and closes at a known kickoff", async () => {
    const user = await User.create({ first_name: "Deadline", last_name: "Target", username: "enrollment-deadline", email: "enrollment-deadline@example.test", password: "safe-test-password" });
    const season = await LeagueSeason.findOne();
    await season.update({ state: "ACTIVE", current_week: 1, state_version: 1 });
    const withoutSchedule = await createPreview("CREATE_TRACK", { userId: user.id }, { now: new Date("2026-09-10T00:00:00Z") });
    assert.equal(withoutSchedule.action, "CREATE_TRACK");

    await ScheduleSnapshot.create({ league_season_id: season.id, week: 1, provider: "FIXTURE_DOWNLOAD", content_hash: "8".repeat(64), normalized_schedule: { week: 1, games: [{ kickoff: "2026-09-10T00:00:00.000Z", homeTeam: "Broncos", awayTeam: "Raiders" }] }, fetched_at: new Date(), created_at: new Date() });
    await assert.rejects(createPreview("CREATE_TRACK", { userId: user.id }, { now: new Date("2026-09-10T00:00:00Z") }), /enrollment is closed/);
  });

  test("Track creation confirmation rechecks a known kickoff", async () => {
    const user = await User.create({ first_name: "Stale", last_name: "Enrollment", username: "stale-enrollment", email: "stale-enrollment@example.test", password: "safe-test-password" });
    const season = await LeagueSeason.findOne();
    await season.update({ state: "ACTIVE", current_week: 1, state_version: 1 });
    await ScheduleSnapshot.create({ league_season_id: season.id, week: 1, provider: "FIXTURE_DOWNLOAD", content_hash: "9".repeat(64), normalized_schedule: { week: 1, games: [{ kickoff: "2026-09-10T00:00:00.000Z", homeTeam: "Broncos", awayTeam: "Raiders" }] }, fetched_at: new Date(), created_at: new Date() });
    const preview = await createPreview("CREATE_TRACK", { userId: user.id }, { now: new Date("2026-09-09T23:59:59Z") });
    await assert.rejects(confirmPreview("CREATE_TRACK", preview.confirmationKey, null, { now: new Date("2026-09-10T00:00:00Z") }), /enrollment is closed/);
    assert.equal(await Track.count(), 0);
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

  test("official result confirmation commits one immutable actorless override and audit", async () => {
    const season = await LeagueSeason.findOne();
    await season.update({ state: "ACTIVE", current_week: 1, state_version: 1 });
    const scheduleHash = "c".repeat(64);
    await ScheduleSnapshot.create({
      league_season_id: season.id,
      week: 1,
      provider: "FIXTURE_DOWNLOAD",
      content_hash: scheduleHash,
      normalized_schedule: { week: 1, games: [{ kickoff: "2026-09-10T00:00:00.000Z", homeTeam: "Broncos", awayTeam: "Raiders" }] },
      fetched_at: new Date(),
      created_at: new Date(),
    });

    const preview = await createPreview("OVERRIDE_GAME_RESULT", {
      homeTeam: "Broncos",
      awayTeam: "Raiders",
      homeScore: 13,
      awayScore: 20,
      explanation: "Official correction announced after the feed stalled",
      sourceUrl: "https://example.test/official-result",
    });
    const operation = await confirmPreview("OVERRIDE_GAME_RESULT", preview.confirmationKey);
    const resultOverride = await OfficialGameResultOverride.findOne();

    assert.equal(operation.action, "OVERRIDE_GAME_RESULT");
    assert.equal(operation.note, "Official correction announced after the feed stalled");
    assert.equal(resultOverride.schedule_hash, scheduleHash);
    assert.equal(resultOverride.winner_team, "Raiders");
    assert.equal(resultOverride.admin_audit_operation_id, operation.id);
    assert.equal(await OfficialGameResultOverride.count(), 1);
    assert.equal(JSON.stringify(operation.toJSON()).includes("actor"), false);

    const repeatedPreview = await createPreview("OVERRIDE_GAME_RESULT", {
      homeTeam: "Broncos", awayTeam: "Raiders", homeScore: 13, awayScore: 20,
      explanation: "Official correction announced after the feed stalled",
      sourceUrl: "https://example.test/official-result",
    });
    const repeated = await confirmPreview("OVERRIDE_GAME_RESULT", repeatedPreview.confirmationKey);
    assert.equal(repeated.id, operation.id);
    assert.equal(await OfficialGameResultOverride.count(), 1);
    assert.equal(await AdminAuditOperation.count({ where: { action: "OVERRIDE_GAME_RESULT" } }), 1);

    await assert.rejects(createPreview("OVERRIDE_GAME_RESULT", {
      homeTeam: "Broncos", awayTeam: "Raiders", homeScore: 14, awayScore: 20,
      explanation: "Conflicting result", sourceUrl: "",
    }), /immutable/);
    assert.equal(await OfficialGameResultOverride.count(), 1);
  });

  test("manual close previews unfinished unselected games and atomically audits one week closure", async () => {
    const season = await LeagueSeason.findOne();
    await season.update({ state: "ACTIVE", current_week: 1, state_version: 1 });
    const user = await User.create({ first_name: "Manual", last_name: "Close", username: "manual-close", email: "manual-close@example.test", password: "safe-test-password" });
    const track = await Track.create({ user_id: user.id, league_season_id: season.id, available_picks: ["Chiefs"], used_picks: ["Raiders"], current_pick: "Raiders", wrong_pick: null, state_version: 0 });
    const scheduleHash = "d".repeat(64);
    const schedule = { week: 1, games: [
      { kickoff: "2026-09-10T00:00:00.000Z", homeTeam: "Broncos", awayTeam: "Raiders" },
      { kickoff: "2026-09-13T20:00:00.000Z", homeTeam: "Chiefs", awayTeam: "Chargers" },
    ] };
    await ScheduleSnapshot.create({ league_season_id: season.id, week: 1, provider: "FIXTURE_DOWNLOAD", content_hash: scheduleHash, normalized_schedule: schedule, fetched_at: new Date(), created_at: new Date() });
    await Pick.create({ track_id: track.id, league_season_id: season.id, week: 1, team_name: "Raiders", origin: "USER_SUBMISSION", outcome: "PENDING", committed_at: new Date(), schedule_hash: scheduleHash, state_version: 0 });
    await LeagueWeekOperation.create({ league_season_id: season.id, week: 1, phase: "AUTO_PICK", mode: "AUTOMATIC", schedule_hash: scheduleHash, summary: { assignedCount: 0 }, completed_at: new Date() });
    const manualClosureContext = {
      leagueSeasonId: season.id,
      week: 1,
      scheduleHash,
      games: [
        { homeTeam: "Broncos", awayTeam: "Raiders", status: "FINAL", winnerTeam: "Broncos", loserTeam: "Raiders", tied: false },
        { homeTeam: "Chiefs", awayTeam: "Chargers", status: "PENDING" },
      ],
      selectedTeamNames: ["Raiders"],
      unfinishedUnselectedGames: [{ homeTeam: "Chiefs", awayTeam: "Chargers" }],
    };

    const preview = await createPreview("CLOSE_WEEK", {}, { manualClosureContext });
    assert.deepEqual(preview.unfinishedUnselectedGames, [{ homeTeam: "Chiefs", awayTeam: "Chargers" }]);
    const operation = await confirmPreview("CLOSE_WEEK", preview.confirmationKey, "All selected games are official", { manualClosureContext });

    assert.equal(operation.action, "CLOSE_WEEK");
    assert.equal(operation.note, "All selected games are official");
    assert.equal(await LeagueWeekOperation.count({ where: { phase: "CLOSE_WEEK" } }), 1);
    assert.equal((await LeagueSeason.findByPk(season.id)).current_week, 2);
    assert.equal(await AdminAuditOperation.count({ where: { action: "CLOSE_WEEK" } }), 1);
  });

  test("completion derives tied wins from unique winning Users and is replay safe", async () => {
    const season = await LeagueSeason.findOne();
    await season.update({ state: "ACTIVE", current_week: 2, state_version: 3 });
    await LeagueWeekOperation.create({ league_season_id: season.id, week: 1, phase: "CLOSE_WEEK", mode: "AUTOMATIC", schedule_hash: "a".repeat(64), summary: {}, completed_at: new Date() });
    const users = await Promise.all([
      User.create({ first_name: "One", last_name: "Winner", username: "winner-one", email: "winner-one@example.test", password: "safe-test-password" }),
      User.create({ first_name: "Two", last_name: "Winner", username: "winner-two", email: "winner-two@example.test", password: "safe-test-password" }),
    ]);
    const tracks = await Promise.all(users.map((user) => Track.create({ user_id: user.id, league_season_id: season.id, available_picks: ["Broncos"], used_picks: [], current_pick: null, wrong_pick: null, state_version: 0 })));

    const preview = await createPreview("COMPLETE_LEAGUE_SEASON", { winnerTrackIds: tracks.map((track) => track.id) });
    const operation = await confirmPreview("COMPLETE_LEAGUE_SEASON", preview.confirmationKey, "Final winners verified");
    assert.equal(operation.action, "COMPLETE_LEAGUE_SEASON");
    assert.equal((await LeagueSeason.findByPk(season.id)).state, "COMPLETE");
    for (const user of users) assert.deepEqual((await User.findByPk(user.id)).user_record, [{ year: 2026, won: true, won_with_tie: true }]);
    assert.equal((await confirmPreview("COMPLETE_LEAGUE_SEASON", preview.confirmationKey)).id, operation.id);
    assert.equal(await AdminAuditOperation.count({ where: { action: "COMPLETE_LEAGUE_SEASON" } }), 1);
  });

  test("rollover requires validated explicit year, deletes outgoing Tracks and Picks, and creates Week 0", async () => {
    const season = await LeagueSeason.findOne();
    await season.update({ state: "COMPLETE", current_week: 22, state_version: 9, open_slot: null });
    const user = await User.create({ first_name: "Preserved", last_name: "User", username: "preserved", email: "preserved@example.test", password: "safe-test-password", user_record: [{ year: 2026, won: true, won_with_tie: false }] });
    const track = await Track.create({ user_id: user.id, league_season_id: season.id, available_picks: [], used_picks: ["Broncos"], current_pick: "Broncos", wrong_pick: null, state_version: 2 });
    await Pick.create({ track_id: track.id, league_season_id: season.id, week: 22, pick_cycle: 2, team_name: "Broncos", origin: "USER_SUBMISSION", outcome: "PREDICTION_CORRECT", committed_at: new Date(), state_version: 1 });
    const loader = async ({ year, week }) => ({ year, week, contentHash: "b".repeat(64) });

    const preview = await createPreview("ROLLOVER_LEAGUE_SEASON", { targetYear: "2027" }, { loadRolloverTargetSchedule: loader });
    assert.equal(preview.rolloverExport.exportDocument.tracks[0].userId, user.id);
    assert.match(preview.rolloverExport.exportChecksum, /^[a-f0-9]{64}$/);
    await assert.rejects(confirmPreview("ROLLOVER_LEAGUE_SEASON", preview.confirmationKey, null, { loadRolloverTargetSchedule: loader }), /Confirm Yes/);
    const operation = await confirmPreview("ROLLOVER_LEAGUE_SEASON", preview.confirmationKey, "Export retained", { loadRolloverTargetSchedule: loader, confirmationPhrase: "YES" });

    assert.equal(operation.summary.exportChecksum, preview.rolloverExport.exportChecksum);
    assert.equal(await Track.count({ where: { league_season_id: season.id } }), 0);
    assert.equal(await Pick.count({ where: { league_season_id: season.id } }), 0);
    assert.equal((await LeagueSeason.findByPk(season.id)).state, "ROLLED_OVER");
    const successor = await LeagueSeason.findOne({ where: { year: 2027 } });
    assert.deepEqual({ state: successor.state, week: successor.current_week, cycle: successor.pick_cycle, open: successor.open_slot }, { state: "SETUP", week: 0, cycle: 1, open: 1 });
    assert.equal((await User.findByPk(user.id)).user_record[0].year, 2026);
  });
}
