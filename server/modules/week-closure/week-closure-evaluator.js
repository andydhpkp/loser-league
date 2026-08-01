const { planNextResultCheck } = require("./week-closure-polling");
const { reconcileWeeklyResults } = require("./week-results-policy");
const { LeagueSeason, ScheduleSnapshot, OfficialGameResultOverride } = require("../../../models");
const { fetchFixtureSchedule } = require("../../nfl/fixture-download-client");
const { createEspnClient } = require("../../nfl/espn-client");
const { closeWeek } = require("./week-closure-service");

const EXPECTED_GAME_DURATION_MS = 165 * 60 * 1000;

function createWeekClosureEvaluator({
  findSeason,
  fetchSchedule,
  persistSchedule,
  fetchResults,
  findOverrides,
  execute,
  now = () => new Date(),
}) {
  let cachedSchedule;
  return async function evaluate() {
    const season = await findSeason();
    if (!season || season.state !== "ACTIVE" || season.current_week === 0) {
      return { status: "NOT_DUE", nextCheckAt: null };
    }
    if (cachedSchedule && (cachedSchedule.year !== season.year || cachedSchedule.week !== season.current_week)) {
      cachedSchedule = undefined;
    }
    const currentTime = now();
    if (!cachedSchedule) {
      cachedSchedule = await fetchSchedule({ year: season.year, week: season.current_week, now: currentTime });
      await persistSchedule({ season, schedule: cachedSchedule, now: currentTime });
    }
    const kickoffs = cachedSchedule.normalizedSchedule.games.map((game) => game.kickoff);
    const firstExpectedFinish = new Date(Math.min(...kickoffs.map((kickoff) => new Date(kickoff).getTime() + EXPECTED_GAME_DURATION_MS)));
    if (firstExpectedFinish > currentTime) {
      return { status: "NOT_DUE", nextCheckAt: firstExpectedFinish };
    }

    const espnSchedule = await fetchResults({ year: season.year, week: season.current_week });
    const overrides = await findOverrides({ leagueSeasonId: season.id, week: season.current_week });
    const reconciled = reconcileWeeklyResults({ fixtureSchedule: cachedSchedule.normalizedSchedule, espnSchedule, overrides });
    if (!reconciled.allFinal) {
      const next = planNextResultCheck({ now: currentTime, kickoffs, games: reconciled.games });
      if (next.refreshSchedule) cachedSchedule = undefined;
      return { status: "PENDING", nextCheckAt: next.checkAt, refreshSchedule: next.refreshSchedule };
    }
    return execute({
      leagueSeasonId: season.id,
      week: season.current_week,
      scheduleHash: cachedSchedule.contentHash,
      mode: "AUTOMATIC",
      games: reconciled.games,
      now: currentTime,
    });
  };
}

function createDefaultWeekClosureEvaluator({ fetchImpl = global.fetch, now = () => new Date() } = {}) {
  const espnClient = createEspnClient({ fetchImpl });
  return createWeekClosureEvaluator({
    findSeason: () => LeagueSeason.findOne({ where: { open_slot: 1 } }),
    fetchSchedule: (input) => fetchFixtureSchedule({ ...input, fetchImpl }),
    persistSchedule: async ({ season, schedule, now: currentTime }) => {
      await ScheduleSnapshot.findOrCreate({
        where: { league_season_id: season.id, week: season.current_week, provider: schedule.provider, content_hash: schedule.contentHash },
        defaults: { normalized_schedule: schedule.normalizedSchedule, fetched_at: schedule.fetchedAt, created_at: currentTime },
      });
    },
    fetchResults: (input) => espnClient.fetchSchedule(input),
    findOverrides: async ({ leagueSeasonId, week }) => {
      const rows = await OfficialGameResultOverride.findAll({ where: { league_season_id: leagueSeasonId, week } });
      return rows.map((row) => ({ homeTeam: row.home_team, awayTeam: row.away_team, homeScore: row.home_score, awayScore: row.away_score }));
    },
    execute: closeWeek,
    now,
  });
}

module.exports = { createDefaultWeekClosureEvaluator, createWeekClosureEvaluator };
