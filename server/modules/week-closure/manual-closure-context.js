const { Op } = require("sequelize");
const {
  LeagueSeason,
  ScheduleSnapshot,
  OfficialGameResultOverride,
  LeagueWeekOperation,
  Track,
  Pick,
} = require("../../../models");
const { ConflictError } = require("../../lib/errors");
const { createEspnClient } = require("../../nfl/espn-client");
const { planPickOutcomes, reconcileWeeklyResults } = require("./week-results-policy");

function createManualClosureContextLoader({
  findSeason,
  findSchedule,
  fetchResults,
  findOverrides,
  findAutoPick,
  findActiveTracks,
  findPicks,
}) {
  return async function loadManualClosureContext() {
    const season = await findSeason();
    if (!season || season.state !== "ACTIVE") throw new ConflictError("Manual closure requires an active League Season");
    const schedule = await findSchedule({ leagueSeasonId: season.id, week: season.current_week });
    if (!schedule) throw new ConflictError("A validated weekly schedule is required");
    const [espnSchedule, overrides, autoPick, tracks] = await Promise.all([
      fetchResults({ year: season.year, week: season.current_week, seasonType: season.schedule_phase === "PRESEASON" ? "preseason" : "regular" }),
      findOverrides({ leagueSeasonId: season.id, week: season.current_week }),
      findAutoPick({ leagueSeasonId: season.id, week: season.current_week, scheduleHash: schedule.content_hash }),
      findActiveTracks({ leagueSeasonId: season.id }),
    ]);
    if (!autoPick) throw new ConflictError("Automatic Picks must complete before manual closure");
    const picks = await findPicks({ leagueSeasonId: season.id, week: season.current_week, trackIds: tracks.map((track) => track.id) });
    if (picks.length !== tracks.length || picks.some((pick) => pick.outcome !== "PENDING")) {
      throw new ConflictError("Every active Track must have one pending Pick for the current schedule");
    }
    const reconciled = reconcileWeeklyResults({ fixtureSchedule: schedule.normalized_schedule, espnSchedule, overrides });
    const selectedTeamNames = picks.map((pick) => pick.team_name);
    try {
      planPickOutcomes({ picks: picks.map((pick) => ({ id: pick.id, trackId: pick.track_id, teamName: pick.team_name })), games: reconciled.games });
    } catch (_error) {
      throw new ConflictError("Every active Track's selected game must be final");
    }
    const selected = new Set(selectedTeamNames);
    const unfinishedUnselectedGames = reconciled.games
      .filter((game) => game.status !== "FINAL" && !selected.has(game.homeTeam) && !selected.has(game.awayTeam))
      .map(({ homeTeam, awayTeam }) => ({ homeTeam, awayTeam }));
    return { leagueSeasonId: season.id, week: season.current_week, scheduleHash: schedule.content_hash, games: reconciled.games, selectedTeamNames, unfinishedUnselectedGames };
  };
}

function createDefaultManualClosureContextLoader({ fetchImpl = global.fetch } = {}) {
  const espnClient = createEspnClient({ fetchImpl });
  return createManualClosureContextLoader({
    findSeason: () => LeagueSeason.findOne({ where: { open_slot: 1 } }),
    findSchedule: ({ leagueSeasonId, week }) => ScheduleSnapshot.findOne({ where: { league_season_id: leagueSeasonId, week }, order: [["fetched_at", "DESC"]] }),
    fetchResults: (input) => espnClient.fetchSchedule(input),
    findOverrides: async ({ leagueSeasonId, week }) => {
      const rows = await OfficialGameResultOverride.findAll({ where: { league_season_id: leagueSeasonId, week } });
      return rows.map((row) => ({ homeTeam: row.home_team, awayTeam: row.away_team, homeScore: row.home_score, awayScore: row.away_score }));
    },
    findAutoPick: ({ leagueSeasonId, week }) => LeagueWeekOperation.findOne({ where: { league_season_id: leagueSeasonId, week, phase: "AUTO_PICK" } }),
    findActiveTracks: ({ leagueSeasonId }) => Track.findAll({ where: { league_season_id: leagueSeasonId, eliminated_by_pick_id: { [Op.is]: null } }, attributes: ["id"] }),
    findPicks: ({ leagueSeasonId, week, trackIds }) => trackIds.length ? Pick.findAll({ where: { league_season_id: leagueSeasonId, week, track_id: { [Op.in]: trackIds } } }) : [],
  });
}

module.exports = { createDefaultManualClosureContextLoader, createManualClosureContextLoader };
