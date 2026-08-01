const test = require("node:test");
const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  test("exactly-once week closure", { skip: "TEST_DATABASE_URL is not set" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  const assert = require("node:assert/strict");
  const {
    sequelize,
    User,
    Track,
    LeagueSeason,
    Pick,
    ScheduleSnapshot,
    LeagueWeekOperation,
  } = require("../../models");
  const { closeWeek } = require("../../server/modules/week-closure/week-closure-service");
  const { migrateEmptyTestDatabase } = require("../support/migrate-test-database");

  test.beforeEach(async () => migrateEmptyTestDatabase(sequelize));
  test.after(async () => sequelize.close());

  test("closure settles Picks, eliminates only Wrong Picks, clears current Picks, and advances once", async () => {
    const season = await LeagueSeason.create({ year: 2026, state: "ACTIVE", current_week: 1, state_version: 0, open_slot: 1 });
    const user = await User.create({ first_name: "Week", last_name: "Close", username: "week-close", email: "week-close@example.test", password: "safe-test-password" });
    const survivor = await Track.create({ user_id: user.id, league_season_id: season.id, available_picks: ["Chiefs"], used_picks: ["Raiders"], current_pick: "Raiders", wrong_pick: null, state_version: 0 });
    const eliminated = await Track.create({ user_id: user.id, league_season_id: season.id, available_picks: ["Chiefs"], used_picks: ["Broncos"], current_pick: "Broncos", wrong_pick: null, state_version: 0 });
    const pickScheduleHash = "a".repeat(64);
    const scheduleHash = "b".repeat(64);
    await ScheduleSnapshot.create({ league_season_id: season.id, week: 1, provider: "FIXTURE_DOWNLOAD", content_hash: pickScheduleHash, normalized_schedule: { week: 1, games: [{ kickoff: "2026-09-09T23:30:00.000Z", homeTeam: "Broncos", awayTeam: "Raiders" }] }, fetched_at: new Date("2026-09-09T23:00:00Z"), created_at: new Date("2026-09-09T23:00:00Z") });
    await ScheduleSnapshot.create({ league_season_id: season.id, week: 1, provider: "FIXTURE_DOWNLOAD", content_hash: scheduleHash, normalized_schedule: { week: 1, games: [{ kickoff: "2026-09-10T00:00:00.000Z", homeTeam: "Broncos", awayTeam: "Raiders" }] }, fetched_at: new Date("2026-09-10T00:00:00Z"), created_at: new Date("2026-09-10T00:00:00Z") });
    const survivorPick = await Pick.create({ track_id: survivor.id, league_season_id: season.id, week: 1, team_name: "Raiders", origin: "USER_SUBMISSION", outcome: "PENDING", committed_at: new Date(), schedule_hash: pickScheduleHash, state_version: 0 });
    const eliminatedPick = await Pick.create({ track_id: eliminated.id, league_season_id: season.id, week: 1, team_name: "Broncos", origin: "USER_SUBMISSION", outcome: "PENDING", committed_at: new Date(), schedule_hash: pickScheduleHash, state_version: 0 });
    await LeagueWeekOperation.create({ league_season_id: season.id, week: 1, phase: "AUTO_PICK", mode: "AUTOMATIC", schedule_hash: pickScheduleHash, summary: { assignedCount: 0 }, completed_at: new Date() });

    const result = await closeWeek({
      leagueSeasonId: season.id,
      week: 1,
      scheduleHash,
      mode: "AUTOMATIC",
      games: [{ homeTeam: "Broncos", awayTeam: "Raiders", status: "FINAL", winnerTeam: "Broncos", loserTeam: "Raiders", tied: false }],
    });

    assert.equal(result.status, "COMPLETED");
    await Promise.all([season.reload(), survivor.reload(), eliminated.reload(), survivorPick.reload(), eliminatedPick.reload()]);
    assert.equal(season.current_week, 2);
    assert.equal(season.state_version, 1);
    assert.equal(survivorPick.outcome, "PREDICTION_CORRECT");
    assert.equal(eliminatedPick.outcome, "WRONG_PICK");
    assert.equal(survivor.eliminated_by_pick_id, null);
    assert.equal(eliminated.eliminated_by_pick_id, eliminatedPick.id);
    assert.equal(survivor.current_pick, null);
    assert.equal(eliminated.current_pick, null);
    assert.deepEqual(survivor.used_picks, ["Raiders"]);
    assert.deepEqual(eliminated.available_picks, ["Chiefs"]);
    assert.equal(eliminated.wrong_pick, "Broncos");
    assert.equal(await LeagueWeekOperation.count({ where: { league_season_id: season.id, week: 1, phase: "CLOSE_WEEK" } }), 1);

    const replay = await closeWeek({
      leagueSeasonId: season.id,
      week: 1,
      scheduleHash,
      mode: "MANUAL",
      games: [{ homeTeam: "Broncos", awayTeam: "Raiders", status: "FINAL", winnerTeam: "Broncos", loserTeam: "Raiders", tied: false }],
    });
    assert.equal(replay.status, "ALREADY_COMPLETED");
    assert.equal(await LeagueWeekOperation.count({ where: { league_season_id: season.id, week: 1, phase: "CLOSE_WEEK" } }), 1);
    assert.equal((await LeagueSeason.findByPk(season.id)).current_week, 2);
  });

  test("Week 22 closure records the phase without inventing Week 23 or completing the season", async () => {
    const season = await LeagueSeason.create({ year: 2026, state: "ACTIVE", current_week: 22, state_version: 4, open_slot: 1 });
    const scheduleHash = "f".repeat(64);
    const normalizedSchedule = { week: 22, games: [{ kickoff: "2027-02-14T23:30:00.000Z", homeTeam: "Broncos", awayTeam: "Raiders" }] };
    await ScheduleSnapshot.create({ league_season_id: season.id, week: 22, provider: "FIXTURE_DOWNLOAD", content_hash: scheduleHash, normalized_schedule: normalizedSchedule, fetched_at: new Date(), created_at: new Date() });
    await LeagueWeekOperation.create({ league_season_id: season.id, week: 22, phase: "AUTO_PICK", mode: "AUTOMATIC", schedule_hash: scheduleHash, summary: { assignedCount: 0 }, completed_at: new Date() });

    const result = await closeWeek({ leagueSeasonId: season.id, week: 22, scheduleHash, mode: "AUTOMATIC", games: [{ homeTeam: "Broncos", awayTeam: "Raiders", status: "FINAL", winnerTeam: "Broncos", loserTeam: "Raiders", tied: false }] });

    await season.reload();
    assert.equal(result.status, "COMPLETED");
    assert.equal(result.advancedToWeek, 22);
    assert.equal(season.current_week, 22);
    assert.equal(season.state, "ACTIVE");
    assert.equal(season.state_version, 5);
  });

  test("concurrent automatic and manual attempts commit one closure and one advancement", async () => {
    const season = await LeagueSeason.create({ year: 2026, state: "ACTIVE", current_week: 2, state_version: 0, open_slot: 1 });
    const scheduleHash = "9".repeat(64);
    const normalizedSchedule = { week: 2, games: [{ kickoff: "2026-09-20T17:00:00.000Z", homeTeam: "Broncos", awayTeam: "Raiders" }] };
    await ScheduleSnapshot.create({ league_season_id: season.id, week: 2, provider: "FIXTURE_DOWNLOAD", content_hash: scheduleHash, normalized_schedule: normalizedSchedule, fetched_at: new Date(), created_at: new Date() });
    await LeagueWeekOperation.create({ league_season_id: season.id, week: 2, phase: "AUTO_PICK", mode: "AUTOMATIC", schedule_hash: scheduleHash, summary: { assignedCount: 0 }, completed_at: new Date() });
    const input = { leagueSeasonId: season.id, week: 2, scheduleHash, games: [{ homeTeam: "Broncos", awayTeam: "Raiders", status: "FINAL", winnerTeam: "Broncos", loserTeam: "Raiders", tied: false }] };

    const results = await Promise.all([
      closeWeek({ ...input, mode: "AUTOMATIC" }),
      closeWeek({ ...input, mode: "MANUAL", adminNote: "Concurrent admin request" }),
    ]);

    assert.deepEqual(results.map((result) => result.status).sort(), ["ALREADY_COMPLETED", "COMPLETED"]);
    assert.equal(await LeagueWeekOperation.count({ where: { league_season_id: season.id, week: 2, phase: "CLOSE_WEEK" } }), 1);
    assert.equal((await LeagueSeason.findByPk(season.id)).current_week, 3);
  });
}
