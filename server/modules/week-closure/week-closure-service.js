const { Op, Transaction } = require("sequelize");
const {
  sequelize,
  LeagueSeason,
  Track,
  Pick,
  ScheduleSnapshot,
  LeagueWeekOperation,
  AdminAuditOperation,
  AdminAuditTarget,
} = require("../../../models");
const { ConflictError, ValidationError } = require("../../lib/errors");
const { planPickOutcomes } = require("./week-results-policy");

const VALID_MODES = new Set(["AUTOMATIC", "MANUAL"]);
const scheduleMatchups = (normalizedSchedule) => (normalizedSchedule?.games || [])
  .map((game) => [game.homeTeam, game.awayTeam].sort().join("|"))
  .sort();

async function performCloseWeek({ leagueSeasonId, week, scheduleHash, mode, games, now, adminNote, nextWeek: requestedNextWeek }, transaction) {
    const season = await LeagueSeason.findByPk(leagueSeasonId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!season) throw new ConflictError("League Season changed; retry closure");
    const completed = await LeagueWeekOperation.findOne({
      where: { league_season_id: leagueSeasonId, week, phase: "CLOSE_WEEK" },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (completed) return { status: "ALREADY_COMPLETED", leagueSeasonId, week, operationId: completed.id };
    if (season.state !== "ACTIVE" || season.current_week !== week) {
      throw new ConflictError("League Season changed; retry closure");
    }
    const schedule = await ScheduleSnapshot.findOne({
      where: { league_season_id: leagueSeasonId, week, provider: season.schedule_phase === "PRESEASON" ? "ESPN" : "FIXTURE_DOWNLOAD", content_hash: scheduleHash },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!schedule) throw new ConflictError("Weekly schedule changed; retry closure");
    const autoPick = await LeagueWeekOperation.findOne({
      where: { league_season_id: leagueSeasonId, week, phase: "AUTO_PICK" },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!autoPick) throw new ConflictError("Automatic Picks must complete before week closure");
    const autoPickSchedule = await ScheduleSnapshot.findOne({ where: { league_season_id: leagueSeasonId, week, provider: season.schedule_phase === "PRESEASON" ? "ESPN" : "FIXTURE_DOWNLOAD", content_hash: autoPick.schedule_hash }, transaction, lock: transaction.LOCK.UPDATE });
    if (!autoPickSchedule || !isSameScheduleMatchups(autoPickSchedule.normalized_schedule, schedule.normalized_schedule)) {
      throw new ConflictError("Weekly schedule matchups changed; retry closure");
    }
    if (mode === "AUTOMATIC" && games.some((game) => game.status !== "FINAL")) {
      throw new ConflictError("Every scheduled game must be final for automatic closure");
    }

    const tracks = await Track.findAll({
      where: { league_season_id: leagueSeasonId, eliminated_by_pick_id: { [Op.is]: null } },
      order: [["id", "ASC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const picks = tracks.length ? await Pick.findAll({
      where: { league_season_id: leagueSeasonId, week, track_id: { [Op.in]: tracks.map((track) => track.id) } },
      order: [["track_id", "ASC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    }) : [];
    if (picks.length !== tracks.length || picks.some((pick) => pick.outcome !== "PENDING")) {
      throw new ConflictError("Every active Track must have one pending Pick for the current schedule");
    }
    const outcomes = planPickOutcomes({
      picks: picks.map((pick) => ({ id: pick.id, trackId: pick.track_id, teamName: pick.team_name })),
      games,
    });
    const outcomeByTrack = new Map(outcomes.map((outcome) => [outcome.trackId, outcome]));
    const pickById = new Map(picks.map((pick) => [pick.id, pick]));
    for (const outcome of outcomes) {
      const pick = pickById.get(outcome.pickId);
      await pick.update({ outcome: outcome.outcome, state_version: pick.state_version + 1 }, { transaction });
    }
    for (const track of tracks) {
      const outcome = outcomeByTrack.get(track.id);
      await track.update({
        current_pick: null,
        wrong_pick: outcome.eliminated ? outcome.teamName : null,
        eliminated_by_pick_id: outcome.eliminated ? outcome.pickId : null,
        state_version: track.state_version + 1,
      }, { transaction });
    }
    const priorStateVersion = season.state_version;
    const nextWeek = season.schedule_phase === "PRESEASON" ? (requestedNextWeek || week) : (week < 22 ? week + 1 : 22);
    const preseasonComplete = season.schedule_phase === "PRESEASON" && !requestedNextWeek;
    await season.update({ current_week: nextWeek, preseason_complete: preseasonComplete, state_version: priorStateVersion + 1 }, { transaction });
    const eliminatedCount = outcomes.filter((outcome) => outcome.eliminated).length;
    const operation = await LeagueWeekOperation.create({
      league_season_id: leagueSeasonId,
      week,
      phase: "CLOSE_WEEK",
      mode,
      schedule_hash: scheduleHash,
      summary: { processedCount: outcomes.length, eliminatedCount, survivingCount: outcomes.length - eliminatedCount, advancedToWeek: nextWeek },
      completed_at: now,
    }, { transaction });
    let auditOperationId = null;
    if (mode === "MANUAL") {
      const audit = await AdminAuditOperation.create({ action: "CLOSE_WEEK", description: `Manually close Week ${week} of the ${season.year} League Season`, note: adminNote, status: "COMMITTED", league_season_id: leagueSeasonId, week, summary: { processedCount: outcomes.length, eliminatedCount, advancedToWeek: nextWeek }, undoable: false }, { transaction });
      await AdminAuditTarget.create({ admin_audit_operation_id: audit.id, target_type: "LEAGUE_SEASON", target_id: leagueSeasonId, before_state: { week, stateVersion: priorStateVersion }, after_state: { week: nextWeek, stateVersion: priorStateVersion + 1 }, state_version: priorStateVersion + 1 }, { transaction });
      auditOperationId = audit.id;
    }
    return { status: "COMPLETED", leagueSeasonId, week, operationId: operation.id, auditOperationId, processedCount: outcomes.length, eliminatedCount, advancedToWeek: nextWeek };
}

function isSameScheduleMatchups(left, right) {
  return JSON.stringify(scheduleMatchups(left)) === JSON.stringify(scheduleMatchups(right));
}

async function closeWeek({ leagueSeasonId, week, scheduleHash, mode, games, now = new Date(), transaction, adminNote, nextWeek }) {
  if (!Number.isInteger(leagueSeasonId) || !Number.isInteger(week) || !VALID_MODES.has(mode)) {
    throw new ValidationError("A valid League Season, week, and closure mode are required");
  }
  if (!/^[a-f0-9]{64}$/i.test(scheduleHash || "") || !Array.isArray(games)) {
    throw new ValidationError("A valid schedule and game results are required");
  }
  const input = { leagueSeasonId, week, scheduleHash, mode, games, now, adminNote, nextWeek };
  if (transaction) return performCloseWeek(input, transaction);
  return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, (newTransaction) => performCloseWeek(input, newTransaction));
}

module.exports = { closeWeek };
