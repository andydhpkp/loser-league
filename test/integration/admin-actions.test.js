const test = require("node:test");
const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  test("admin action foundation", { skip: "TEST_DATABASE_URL is not set" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  const assert = require("node:assert/strict");
  const { sequelize, User, Team, Track, Pick, ScheduleSnapshot, LeagueWeekOperation, LeagueSeason, OfficialGameResultOverride, AdminActionPreview, AdminAuditOperation, AdminAuditTarget } = require("../../models");
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
