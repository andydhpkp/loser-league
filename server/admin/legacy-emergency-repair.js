const sequelize = require("../../config/connection");
const { AdminAuditOperation, AdminAuditTarget, LeagueSeason, Track } = require("../../models");

const trackAuditState = (track) => ({
  id: track.id,
  leagueSeasonId: track.league_season_id,
  currentPick: track.current_pick,
  usedPicks: [...track.used_picks],
  availablePicks: [...track.available_picks],
  wrongPick: track.wrong_pick,
  eliminatedByPickId: track.eliminated_by_pick_id,
  stateVersion: track.state_version,
});

async function loadTrackStates(transaction) {
  const tracks = await Track.findAll({
    attributes: ["id", "league_season_id", "current_pick", "used_picks", "available_picks", "wrong_pick", "eliminated_by_pick_id", "state_version"],
    order: [["id", "ASC"]],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  return tracks.map(trackAuditState);
}

function changedTrackTargets(beforeStates, afterStates) {
  const beforeById = new Map(beforeStates.map((state) => [state.id, state]));
  const afterById = new Map(afterStates.map((state) => [state.id, state]));
  const ids = [...new Set([...beforeById.keys(), ...afterById.keys()])].sort((left, right) => left - right);
  return ids.flatMap((id) => {
    const beforeState = beforeById.get(id) || null;
    const afterState = afterById.get(id) || null;
    if (JSON.stringify(beforeState) === JSON.stringify(afterState)) return [];
    return [{ targetId: id, beforeState, afterState }];
  });
}

async function createAudit({ method, routePattern, targets, transaction }) {
  const seasonIds = [...new Set(targets.flatMap((target) => {
    const id = target.afterState?.leagueSeasonId ?? target.beforeState?.leagueSeasonId;
    return id ? [id] : [];
  }))];
  const leagueSeason = seasonIds.length === 1
    ? await LeagueSeason.findByPk(seasonIds[0], { attributes: ["id", "current_week"], transaction })
    : null;
  const operation = await AdminAuditOperation.create({
    action: "LEGACY_EMERGENCY_REPAIR",
    description: `${method} legacy emergency repair ${routePattern}`,
    note: null,
    status: "COMMITTED",
    league_season_id: leagueSeason?.id || null,
    week: leagueSeason?.current_week ?? null,
    summary: { method, routePattern, affectedCount: targets.length },
    undoable: false,
  }, { transaction });
  await AdminAuditTarget.bulkCreate(targets.map((target) => ({
    admin_audit_operation_id: operation.id,
    target_type: "TRACK",
    target_id: target.targetId,
    before_state: target.beforeState,
    after_state: target.afterState,
    state_version: target.afterState?.stateVersion ?? target.beforeState?.stateVersion ?? null,
  })), { transaction });
}

function createLegacyEmergencyRepair({
  beginTransaction = () => sequelize.transaction(),
  createAudit: writeAudit = createAudit,
  loadStates = loadTrackStates,
} = {}) {
  return async function legacyEmergencyRepair(req, res, next) {
    if (req.method === "GET" || req.method === "HEAD") {
      next();
      return;
    }
    let transaction;
    try {
      transaction = await beginTransaction();
    } catch (error) {
      next(error);
      return;
    }
    const originalJson = res.json.bind(res);
    let settle;
    const response = new Promise((resolve) => { settle = resolve; });
    res.locals.legacyEmergencyTransaction = transaction;
    res.json = (body) => {
      settle({ body, statusCode: res.statusCode });
      return res;
    };

    try {
      const beforeStates = await loadStates(transaction);
      next();
      const outcome = await response;
      if (outcome.statusCode >= 400) {
        await transaction.rollback();
      } else {
        const afterStates = await loadStates(transaction);
        await writeAudit({
          method: req.method,
          routePattern: req.route?.path || "unknown",
          targets: changedTrackTargets(beforeStates, afterStates),
          transaction,
        });
        await transaction.commit();
      }
      res.json = originalJson;
      originalJson(outcome.body);
    } catch (error) {
      await transaction.rollback();
      res.json = originalJson;
      next(error);
    }
  };
}

const legacyEmergencyRepair = createLegacyEmergencyRepair();

module.exports = {
  createLegacyEmergencyRepair,
  changedTrackTargets,
  legacyEmergencyRepair,
};
