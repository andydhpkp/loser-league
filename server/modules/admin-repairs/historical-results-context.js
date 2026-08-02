const {
  ScheduleSnapshot,
  OfficialGameResultOverride,
} = require("../../../models");
const { ConflictError } = require("../../lib/errors");
const { createEspnClient } = require("../../nfl/espn-client");
const { reconcileWeeklyResults } = require("../week-closure/week-results-policy");

function createHistoricalResultsLoader({ findSchedule, fetchResults, findOverrides }) {
  return async ({ leagueSeasonId, year, week }) => {
    const schedule = await findSchedule({ leagueSeasonId, week });
    if (!schedule) throw new ConflictError("A validated historical schedule is required");
    const [espnSchedule, overrides] = await Promise.all([
      fetchResults({ year, week }),
      findOverrides({ leagueSeasonId, week }),
    ]);
    const reconciled = reconcileWeeklyResults({ fixtureSchedule: schedule.normalized_schedule, espnSchedule, overrides });
    if (!reconciled.allFinal) throw new ConflictError("Every historical game must have an authoritative final result");
    return { week, scheduleHash: schedule.content_hash, games: reconciled.games };
  };
}

function createDefaultHistoricalResultsLoader({ fetchImpl = global.fetch } = {}) {
  const espnClient = createEspnClient({ fetchImpl });
  return createHistoricalResultsLoader({
    findSchedule: ({ leagueSeasonId, week }) => ScheduleSnapshot.findOne({
      where: { league_season_id: leagueSeasonId, week, provider: "FIXTURE_DOWNLOAD" },
      order: [["fetched_at", "DESC"]],
    }),
    fetchResults: (input) => espnClient.fetchSchedule(input),
    findOverrides: async ({ leagueSeasonId, week }) => {
      const rows = await OfficialGameResultOverride.findAll({ where: { league_season_id: leagueSeasonId, week } });
      return rows.map((row) => ({ homeTeam: row.home_team, awayTeam: row.away_team, homeScore: row.home_score, awayScore: row.away_score }));
    },
  });
}

module.exports = { createDefaultHistoricalResultsLoader, createHistoricalResultsLoader };
