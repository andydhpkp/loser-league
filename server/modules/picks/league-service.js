const { Op } = require("sequelize");
const { User, Track, Pick, LeagueSeason, ScheduleSnapshot } = require("../../../models");
const { ConflictError } = require("../../lib/errors");
const { fetchFixtureSchedule } = require("../../nfl/fixture-download-client");
const { currentPickVisibility, eligibleTeamsForTrack } = require("./submission-policy");
const { submitPicks } = require("./submission-service");

async function openSeason() {
  const season = await LeagueSeason.findOne({ where: { open_slot: 1 } });
  if (!season) throw new ConflictError("No open League Season exists");
  return season;
}

async function getSubmissionState({ userId }) {
  const season = await openSeason();
  const tracks = await Track.findAll({ where: { user_id: userId, league_season_id: season.id, eliminated_by_pick_id: null }, order: [["id", "ASC"]] });
  const picks = await Pick.findAll({ where: { track_id: { [Op.in]: tracks.map((track) => track.id) }, league_season_id: season.id }, order: [["week", "ASC"]] });
  const latest = season.current_week > 0 ? await ScheduleSnapshot.findOne({ where: { league_season_id: season.id, week: season.current_week }, order: [["fetched_at", "DESC"]] }) : null;
  const scheduledTeams = latest ? [...new Set(latest.normalized_schedule.games.flatMap((game) => [game.homeTeam, game.awayTeam]))].sort() : [];
  return {
    leagueSeason: { id: season.id, year: season.year, week: season.current_week, state: season.state },
    scheduleAvailable: Boolean(latest),
    tracks: tracks.map((track) => {
      const history = picks.filter((pick) => pick.track_id === track.id);
      const current = history.find((pick) => pick.week === season.current_week);
      const usedTeamNames = history.filter((pick) => pick.week < season.current_week).map((pick) => pick.team_name);
      return { id: track.id, stateVersion: track.state_version, status: current ? "SUBMITTED" : "NOT_SUBMITTED", committedTeamName: current?.team_name || null, usedTeamNames, eligibleTeams: current ? [] : eligibleTeamsForTrack({ scheduledTeams, priorTeamNames: usedTeamNames }) };
    }),
  };
}

async function getLeagueView({ userId }) {
  const season = await openSeason();
  const allUsers = await User.findAll({ attributes: ["id", "first_name", "last_name", "user_record"], order: [["id", "ASC"]] });
  const tracks = await Track.findAll({ where: { league_season_id: season.id }, order: [["id", "ASC"]] });
  const current = season.current_week > 0 ? await Pick.findAll({ where: { league_season_id: season.id, week: season.current_week } }) : [];
  const pickByTrack = new Map(current.map((pick) => [pick.track_id, pick]));
  const viewerActive = tracks.filter((track) => track.user_id === userId && track.eliminated_by_pick_id === null);
  const pickVisibility = currentPickVisibility({ activeTrackIds: viewerActive.map((track) => track.id), pickedTrackIds: current.map((pick) => pick.track_id) });
  const users = new Map(allUsers.map((user) => [user.id, { id: user.id, firstName: user.first_name, lastName: user.last_name, crownType: user.getCrownType(), tracks: [] }]));
  for (const track of tracks) {
    if (track.eliminated_by_pick_id === null) {
      const pick = pickByTrack.get(track.id);
      users.get(track.user_id).tracks.push({ id: track.id, currentPick: pickVisibility === "HIDDEN" ? { status: "HIDDEN" } : pick ? { status: "VISIBLE", teamName: pick.team_name } : { status: "NOT_SUBMITTED" } });
    }
  }
  const result = [...users.values()].map((user) => ({ ...user, tracksRemaining: user.tracks.length, picksSubmitted: user.tracks.every((track) => track.currentPick.status !== "NOT_SUBMITTED" && track.currentPick.status !== "HIDDEN") || user.tracks.every((track) => pickByTrack.has(track.id)) }));
  return { leagueSeason: { id: season.id, year: season.year, week: season.current_week }, pickVisibility, users: result, pickStatistics: pickVisibility === "HIDDEN" ? null : undefined };
}

async function submit({ userId, selections, fetchImpl, now = new Date() }) {
  const season = await openSeason();
  if (season.state !== "ACTIVE") throw new ConflictError("Pick submission is not open");
  const schedule = await fetchFixtureSchedule({ year: season.year, week: season.current_week, fetchImpl, now });
  return submitPicks({ userId, selections, schedule, now });
}

module.exports = { getLeagueView, getSubmissionState, submit };
