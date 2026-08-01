const { Transaction, Op } = require("sequelize");
const { sequelize, LeagueSeason, Track, Pick, ScheduleSnapshot } = require("../../../models");
const { ConflictError, ValidationError } = require("../../lib/errors");
const { eligibleTeamsForTrack } = require("./submission-policy");

function normalizedSelections(selections) {
  if (!Array.isArray(selections)) throw new ValidationError("Selections must be an array");
  return selections.map(({ trackId, teamName, stateVersion }) => {
    const id = Number(trackId);
    const version = Number(stateVersion);
    if (!Number.isInteger(id) || id < 1 || !Number.isInteger(version) || version < 0 || typeof teamName !== "string" || !teamName.trim()) {
      throw new ValidationError("Each selection requires a Track ID, state version, and Team");
    }
    return { trackId: id, stateVersion: version, teamName: teamName.trim() };
  });
}

async function submitPicks({ userId, selections, schedule, now = new Date() }) {
  const requested = normalizedSelections(selections);
  if (!schedule || !(schedule.earliestKickoff instanceof Date) || now >= schedule.earliestKickoff) {
    throw new ConflictError("Pick submission is closed");
  }
  return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (transaction) => {
    const season = await LeagueSeason.findOne({ where: { open_slot: 1, state: "ACTIVE" }, transaction, lock: transaction.LOCK.UPDATE });
    if (!season) throw new ConflictError("No active League Season exists");
    if (Number(schedule.year) !== season.year || Number(schedule.week) !== season.current_week) {
      throw new ConflictError("League Season changed; reload before submitting");
    }
    const tracks = await Track.findAll({ where: { user_id: userId, league_season_id: season.id, eliminated_by_pick_id: null }, order: [["id", "ASC"]], transaction, lock: transaction.LOCK.UPDATE });
    const existing = await Pick.findAll({ where: { track_id: { [Op.in]: tracks.map((track) => track.id) }, league_season_id: season.id, week: season.current_week }, transaction, lock: transaction.LOCK.UPDATE });
    const byTrack = new Map(requested.map((selection) => [selection.trackId, selection]));
    if (byTrack.size !== requested.length || requested.length !== tracks.length || tracks.some((track) => !byTrack.has(track.id))) {
      throw new ValidationError("Submit exactly one Pick for every active Track");
    }
    const existingByTrack = new Map(existing.map((pick) => [pick.track_id, pick]));
    for (const track of tracks) {
      const selection = byTrack.get(track.id);
      const committed = existingByTrack.get(track.id);
      if (committed && committed.team_name !== selection.teamName) throw new ConflictError("Submitted Picks are locked");
      if (!committed && track.state_version !== selection.stateVersion) throw new ConflictError(`Track ${track.id} changed; reload before submitting`);
      const prior = await Pick.findAll({ where: { track_id: track.id, league_season_id: season.id, week: { [Op.lt]: season.current_week } }, attributes: ["team_name"], transaction });
      if (!eligibleTeamsForTrack({ scheduledTeams: schedule.teams, priorTeamNames: prior.map((pick) => pick.team_name) }).includes(selection.teamName)) {
        throw new ValidationError(`Track ${track.id} has an ineligible Team`);
      }
    }
    await ScheduleSnapshot.findOrCreate({ where: { league_season_id: season.id, week: season.current_week, provider: schedule.provider, content_hash: schedule.contentHash }, defaults: { normalized_schedule: schedule.normalizedSchedule, fetched_at: schedule.fetchedAt, created_at: now }, transaction });
    for (const track of tracks) {
      if (existingByTrack.has(track.id)) continue;
      const selection = byTrack.get(track.id);
      await Pick.create({ track_id: track.id, league_season_id: season.id, week: season.current_week, team_name: selection.teamName, origin: "USER_SUBMISSION", outcome: "PENDING", committed_at: now, schedule_hash: schedule.contentHash, state_version: 0 }, { transaction });
      const used = [...track.used_picks, selection.teamName];
      await track.update({ current_pick: selection.teamName, used_picks: used, available_picks: track.available_picks.filter((team) => team !== selection.teamName), state_version: track.state_version + 1 }, { transaction });
    }
    const picks = await Pick.findAll({ where: { track_id: { [Op.in]: tracks.map((track) => track.id) }, league_season_id: season.id, week: season.current_week }, order: [["track_id", "ASC"]], transaction });
    return { leagueSeasonId: season.id, week: season.current_week, idempotent: existing.length === tracks.length, picks: picks.map((pick) => ({ trackId: pick.track_id, teamName: pick.team_name, committedAt: pick.committed_at })) };
  });
}

module.exports = { submitPicks };
