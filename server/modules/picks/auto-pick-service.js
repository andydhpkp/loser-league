const crypto = require("node:crypto");
const { Op, Transaction } = require("sequelize");
const { sequelize, LeagueSeason, LeagueWeekOperation, Track, Pick, ScheduleSnapshot } = require("../../../models");
const { ConflictError, ValidationError } = require("../../lib/errors");
const { autoPickDue, planAutomaticSelections } = require("./auto-pick-policy");

function sameMembers(left, right) {
  return left.length === right.length && new Set(left).size === left.length && left.every((value) => right.includes(value));
}

function verifyLegacyProjection(track, priorTeamNames, eligibleTeams) {
  if (track.current_pick || !sameMembers(track.used_picks, priorTeamNames)) throw new ValidationError(`Track ${track.id} Pick state is inconsistent`);
  if (new Set(track.available_picks).size !== track.available_picks.length || track.available_picks.some((team) => track.used_picks.includes(team))) {
    throw new ValidationError(`Track ${track.id} Pick state is inconsistent`);
  }
  if (eligibleTeams.some((team) => !track.available_picks.includes(team))) throw new ValidationError(`Track ${track.id} Pick state is inconsistent`);
}

async function executeAutoPick({ schedule, now = () => new Date(), randomIndex = crypto.randomInt }) {
  const clock = typeof now === "function" ? now : () => now;
  if (!schedule || !autoPickDue({ now: clock(), deadline: schedule.earliestKickoff })) return { status: "NOT_DUE" };
  return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (transaction) => {
    const season = await LeagueSeason.findOne({ where: { open_slot: 1, state: "ACTIVE" }, transaction, lock: transaction.LOCK.UPDATE });
    if (!season || season.current_week === 0) throw new ConflictError("Auto-pick is unavailable");
    if (Number(schedule.year) !== season.year || Number(schedule.week) !== season.current_week) throw new ConflictError("League Season changed; retry evaluation");
    const lockedNow = clock();
    if (!autoPickDue({ now: lockedNow, deadline: schedule.earliestKickoff })) return { status: "NOT_DUE" };
    const completed = await LeagueWeekOperation.findOne({ where: { league_season_id: season.id, week: season.current_week, phase: "AUTO_PICK" }, transaction, lock: transaction.LOCK.UPDATE });
    if (completed) return { status: "ALREADY_COMPLETED", leagueSeasonId: season.id, week: season.current_week };

    const tracks = await Track.findAll({ where: { league_season_id: season.id, eliminated_by_pick_id: null }, order: [["id", "ASC"]], transaction, lock: transaction.LOCK.UPDATE });
    const picks = tracks.length ? await Pick.findAll({ where: { track_id: { [Op.in]: tracks.map((track) => track.id) }, league_season_id: season.id }, transaction, lock: transaction.LOCK.UPDATE }) : [];
    const currentTrackIds = new Set(picks.filter((pick) => pick.week === season.current_week).map((pick) => pick.track_id));
    const targets = tracks.filter((track) => !currentTrackIds.has(track.id)).map((track) => {
      const priorTeamNames = picks.filter((pick) => pick.track_id === track.id && pick.week < season.current_week).map((pick) => pick.team_name);
      const eligibleTeams = schedule.teams.filter((team) => !priorTeamNames.includes(team));
      verifyLegacyProjection(track, priorTeamNames, eligibleTeams);
      return { track, id: track.id, priorTeamNames };
    });
    const selections = planAutomaticSelections({ tracks: targets, scheduledTeams: schedule.teams, randomIndex });

    await ScheduleSnapshot.findOrCreate({ where: { league_season_id: season.id, week: season.current_week, provider: schedule.provider, content_hash: schedule.contentHash }, defaults: { normalized_schedule: schedule.normalizedSchedule, fetched_at: schedule.fetchedAt, created_at: lockedNow }, transaction });
    for (const selection of selections) {
      const target = targets.find(({ id }) => id === selection.trackId);
      await Pick.create({ track_id: target.id, league_season_id: season.id, week: season.current_week, team_name: selection.teamName, origin: "AUTOMATIC_SELECTION", outcome: "PENDING", committed_at: lockedNow, schedule_hash: schedule.contentHash, state_version: 0 }, { transaction });
      await target.track.update({ current_pick: selection.teamName, used_picks: [...target.track.used_picks, selection.teamName], available_picks: target.track.available_picks.filter((team) => team !== selection.teamName), state_version: target.track.state_version + 1 }, { transaction });
    }
    await LeagueWeekOperation.create({ league_season_id: season.id, week: season.current_week, phase: "AUTO_PICK", mode: "AUTOMATIC", schedule_hash: schedule.contentHash, summary: { assignedCount: selections.length, alreadySubmittedCount: tracks.length - selections.length }, completed_at: lockedNow }, { transaction });
    return { status: "COMPLETED", leagueSeasonId: season.id, week: season.current_week, assignedCount: selections.length };
  });
}

module.exports = { executeAutoPick };
