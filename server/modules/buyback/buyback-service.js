const { Op, Transaction } = require("sequelize");
const {
  sequelize, User, LeagueSeason, Track, Pick, BuybackDecision, BuybackDecisionTrack,
  TrackReactivation, AdminAuditOperation,
  ScheduleSnapshot,
} = require("../../../models");
const { ConflictError, ValidationError, NotFoundError } = require("../../lib/errors");
const { BUYBACK_PRICE_CENTS, eligibleWeekOneTracks, normalizeTrackIds, partitionResolution, buybackView } = require("./buyback-policy");

const TERMINAL = new Set(["DECLINED_USER", "COMPLETED_USER_REQUEST", "COMPLETED_ADMIN_DIRECT", "CANCELLED_ADMIN", "EXPIRED_DEADLINE", "CLOSED_BY_PICK"]);

function version(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new ValidationError("A valid buyback state version is required");
  return parsed;
}

async function seasonTracks({ userId, season, transaction, lock = true }) {
  const tracks = await Track.findAll({ where: { user_id: userId, league_season_id: season.id }, order: [["id", "ASC"]], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
  const pickIds = tracks.map((track) => track.eliminated_by_pick_id).filter(Boolean);
  const picks = pickIds.length ? await Pick.findAll({ where: { id: { [Op.in]: pickIds }, league_season_id: season.id }, transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) }) : [];
  const byId = new Map(picks.map((pick) => [pick.id, pick]));
  return { tracks, eligible: eligibleWeekOneTracks(tracks.map((track) => {
    const pick = byId.get(track.eliminated_by_pick_id);
    return { id: track.id, eliminatedByPickId: track.eliminated_by_pick_id, eliminatingPick: pick && { id: pick.id, week: pick.week, outcome: pick.outcome, teamName: pick.team_name } };
  })) };
}

async function currentDecision({ userId, seasonId, transaction, lock = true }) {
  return BuybackDecision.findOne({ where: { user_id: userId, league_season_id: seasonId }, transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
}

async function hasWeekTwoPick({ userId, season, transaction }) {
  const tracks = await Track.findAll({ where: { user_id: userId, league_season_id: season.id }, attributes: ["id"], transaction });
  if (!tracks.length) return false;
  return Boolean(await Pick.findOne({ where: { track_id: { [Op.in]: tracks.map((track) => track.id) }, league_season_id: season.id, week: 2 }, transaction }));
}

async function materializeLocked({ userId, season, now, transaction }) {
  let decision = await currentDecision({ userId, seasonId: season.id, transaction });
  if (decision || season.state !== "ACTIVE" || season.current_week !== 2) return decision;
  const { eligible } = await seasonTracks({ userId, season, transaction });
  if (!eligible.length) return null;
  const picked = await hasWeekTwoPick({ userId, season, transaction });
  decision = await BuybackDecision.create({ user_id: userId, league_season_id: season.id, status: picked ? "CLOSED_BY_PICK" : "ELIGIBLE", origin: picked ? "PICK" : "SYSTEM", unit_price_cents: BUYBACK_PRICE_CENTS, state_version: 0, resolved_at: picked ? now : null }, { transaction });
  return decision;
}

async function childViews(decision, transaction) {
  if (!decision) return [];
  const rows = await BuybackDecisionTrack.findAll({ where: { buyback_decision_id: decision.id }, include: [{ model: Pick, as: "weekOnePick", attributes: ["team_name"] }], order: [["track_id", "ASC"]], transaction });
  return rows.map((row) => ({ trackId: row.track_id, teamName: row.weekOnePick.team_name, resolution: row.resolution }));
}

async function getUserBuyback({ userId, deadlineAvailable, deadline, presentation = {}, now = new Date() }) {
  return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (transaction) => {
    const season = await LeagueSeason.findOne({ where: { open_slot: 1 }, transaction, lock: transaction.LOCK.UPDATE });
    if (!season) return null;
    const decision = await materializeLocked({ userId, season, now, transaction });
    if (!decision) return null;
    if (deadline instanceof Date && now >= deadline && ["ELIGIBLE", "PENDING_USER_REQUEST"].includes(decision.status)) {
      await BuybackDecisionTrack.update({ resolution: "UNFULFILLED" }, { where: { buyback_decision_id: decision.id, resolution: "PENDING" }, transaction });
      await decision.update({ status: "EXPIRED_DEADLINE", origin: "DEADLINE", resolved_at: now, state_version: decision.state_version + 1 }, { transaction });
    }
    let tracks = await childViews(decision, transaction);
    if (decision.status === "ELIGIBLE") tracks = (await seasonTracks({ userId, season, transaction })).eligible.map((item) => ({ ...item, resolution: null }));
    return buybackView({ decision: { status: decision.status, stateVersion: decision.state_version }, tracks, presentation, deadlineAvailable });
  });
}

function requireOpenWindow({ season, deadline, now }) {
  if (season.state !== "ACTIVE" || season.current_week !== 2 || !(deadline instanceof Date) || Number.isNaN(deadline.getTime()) || now >= deadline) throw new ConflictError("Week 2 buyback decisions are unavailable");
}

async function decide({ userId, action, trackIds = [], stateVersion, deadline, now = new Date() }) {
  const requestedVersion = version(stateVersion);
  return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (transaction) => {
    const season = await LeagueSeason.findOne({ where: { open_slot: 1 }, transaction, lock: transaction.LOCK.UPDATE });
    if (!season) throw new ConflictError("No open League Season exists");
    requireOpenWindow({ season, deadline, now });
    const decision = await materializeLocked({ userId, season, now, transaction });
    if (!decision) throw new ConflictError("No eligible buyback opportunity exists");
    const selected = action === "REQUEST" ? normalizeTrackIds(trackIds) : [];
    if (decision.status === "PENDING_USER_REQUEST" && action === "REQUEST") {
      const existing = (await BuybackDecisionTrack.findAll({ where: { buyback_decision_id: decision.id }, transaction })).map((row) => row.track_id).sort((a, b) => a - b);
      if (JSON.stringify(existing) === JSON.stringify(selected)) return { idempotent: true, status: decision.status, stateVersion: decision.state_version };
    }
    if (decision.status === "DECLINED_USER" && action === "DECLINE") return { idempotent: true, status: decision.status, stateVersion: decision.state_version };
    if (decision.status !== "ELIGIBLE" || decision.state_version !== requestedVersion) throw new ConflictError("Buyback decision changed; reload before continuing");
    const { eligible } = await seasonTracks({ userId, season, transaction });
    if (action === "REQUEST") {
      if (selected.some((id) => !eligible.some((item) => item.trackId === id))) throw new ConflictError("Every requested Track must remain eligible");
      for (const id of selected) {
        const item = eligible.find((candidate) => candidate.trackId === id);
        await BuybackDecisionTrack.create({ buyback_decision_id: decision.id, track_id: id, week_one_pick_id: item.pickId, resolution: "PENDING" }, { transaction });
      }
      await decision.update({ status: "PENDING_USER_REQUEST", origin: "USER", requested_at: now, state_version: decision.state_version + 1 }, { transaction });
    } else if (action === "DECLINE") {
      await decision.update({ status: "DECLINED_USER", origin: "USER", resolved_at: now, state_version: decision.state_version + 1 }, { transaction });
    } else throw new ValidationError("Unknown buyback decision action");
    return { idempotent: false, status: decision.status, stateVersion: decision.state_version };
  });
}

async function assertPickAllowedLocked({ userId, season, now, transaction }) {
  if (season.current_week !== 2) return { allowed: true };
  const decision = await materializeLocked({ userId, season, now, transaction });
  if (!decision || TERMINAL.has(decision.status)) return { allowed: true };
  return { allowed: false, status: decision.status };
}

async function expireAtDeadlineLocked({ season, now, transaction }) {
  if (season.current_week !== 2) return 0;
  const users = await User.findAll({ attributes: ["id"], transaction, lock: transaction.LOCK.UPDATE });
  let expired = 0;
  for (const user of users) {
    const decision = await materializeLocked({ userId: user.id, season, now, transaction });
    if (!decision || !["ELIGIBLE", "PENDING_USER_REQUEST"].includes(decision.status)) continue;
    await BuybackDecisionTrack.update({ resolution: "UNFULFILLED" }, { where: { buyback_decision_id: decision.id, resolution: "PENDING" }, transaction });
    await decision.update({ status: "EXPIRED_DEADLINE", origin: "DEADLINE", resolved_at: now, state_version: decision.state_version + 1 }, { transaction });
    expired += 1;
  }
  return expired;
}

async function auditAdmin({ action, season, decision, summary, now, transaction }) {
  return AdminAuditOperation.create({ action, description: `Resolve Week 2 buyback decision ${decision.id}`, status: "COMMITTED", league_season_id: season.id, week: 2, summary, undoable: false, created_at: now }, { transaction });
}

async function requireStoredAdminWindow({ season, now, transaction }) {
  const schedule = await ScheduleSnapshot.findOne({ where: { league_season_id: season.id, week: 2, provider: season.schedule_phase === "PRESEASON" ? "ESPN" : "FIXTURE_DOWNLOAD" }, order: [["fetched_at", "DESC"]], transaction });
  const kickoffs = schedule?.normalized_schedule?.games?.map((game) => new Date(game.kickoff)).filter((date) => !Number.isNaN(date.getTime())) || [];
  if (!kickoffs.length || now >= new Date(Math.min(...kickoffs.map((date) => date.getTime())))) throw new ConflictError("Week 2 buyback administration is closed");
}

async function reactivate({ track, pick, season, audit, transaction }) {
  await track.update({ eliminated_by_pick_id: null, wrong_pick: null, state_version: track.state_version + 1 }, { transaction });
  return TrackReactivation.create({ track_id: track.id, league_season_id: season.id, waived_pick_id: pick.id, admin_audit_operation_id: audit.id }, { transaction });
}

async function resolveAdmin({ decisionId, stateVersion, fulfilledTrackIds = [], cancel = false, paymentConfirmed = false, now = new Date() }) {
  const requestedVersion = version(stateVersion);
  return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (transaction) => {
    const season = await LeagueSeason.findOne({ where: { open_slot: 1 }, transaction, lock: transaction.LOCK.UPDATE });
    if (!season || season.current_week !== 2) throw new ConflictError("Week 2 buyback administration is unavailable");
    await requireStoredAdminWindow({ season, now, transaction });
    const decision = await BuybackDecision.findByPk(Number(decisionId), { transaction, lock: transaction.LOCK.UPDATE });
    if (!decision || decision.league_season_id !== season.id) throw new NotFoundError("Buyback decision not found");
    if (TERMINAL.has(decision.status)) {
      const members = await BuybackDecisionTrack.findAll({ where: { buyback_decision_id: decision.id }, transaction });
      const existingFulfilled = members.filter((row) => row.resolution === "FULFILLED").map((row) => row.track_id).sort((a, b) => a - b);
      const requestedFulfilled = cancel ? [] : Array.isArray(fulfilledTrackIds) ? fulfilledTrackIds.map(Number).sort((a, b) => a - b) : [];
      const exact = (cancel && decision.status === "CANCELLED_ADMIN") || (!cancel && decision.status === "COMPLETED_USER_REQUEST" && JSON.stringify(existingFulfilled) === JSON.stringify(requestedFulfilled));
      if (exact) return { idempotent: true, status: decision.status, stateVersion: decision.state_version };
      throw new ConflictError("Buyback request was already resolved differently");
    }
    if (decision.status !== "PENDING_USER_REQUEST" || decision.state_version !== requestedVersion) throw new ConflictError("Buyback request changed; reload before continuing");
    const members = await BuybackDecisionTrack.findAll({ where: { buyback_decision_id: decision.id }, transaction, lock: transaction.LOCK.UPDATE });
    let partition;
    if (cancel) partition = { fulfilledTrackIds: [], unfulfilledTrackIds: members.map((row) => row.track_id), totalCents: 0 };
    else {
      partition = partitionResolution({ requestedTrackIds: members.map((row) => row.track_id), fulfilledTrackIds });
      if (paymentConfirmed !== true) throw new ValidationError("Confirm that payment was handled externally");
    }
    const audit = await auditAdmin({ action: cancel ? "CANCEL_BUYBACK_REQUEST" : "COMPLETE_BUYBACK_REQUEST", season, decision, summary: { fulfilledCount: partition.fulfilledTrackIds.length, unfulfilledCount: partition.unfulfilledTrackIds.length, totalCents: partition.totalCents }, now, transaction });
    for (const member of members) {
      let reactivation = null;
      if (partition.fulfilledTrackIds.includes(member.track_id)) {
        const track = await Track.findByPk(member.track_id, { transaction, lock: transaction.LOCK.UPDATE });
        const pick = await Pick.findByPk(member.week_one_pick_id, { transaction, lock: transaction.LOCK.UPDATE });
        if (!track || track.user_id !== decision.user_id || track.league_season_id !== season.id || track.eliminated_by_pick_id !== pick?.id || pick.week !== 1 || pick.outcome !== "WRONG_PICK") throw new ConflictError("A requested Track is no longer eligible");
        reactivation = await reactivate({ track, pick, season, audit, transaction });
      }
      await member.update({ resolution: reactivation ? "FULFILLED" : "UNFULFILLED", track_reactivation_id: reactivation?.id || null }, { transaction });
    }
    await decision.update({ status: cancel ? "CANCELLED_ADMIN" : "COMPLETED_USER_REQUEST", origin: "ADMIN", resolved_at: now, admin_audit_operation_id: audit.id, state_version: decision.state_version + 1 }, { transaction });
    return { idempotent: false, status: decision.status, stateVersion: decision.state_version, fulfilledTrackIds: partition.fulfilledTrackIds };
  });
}

async function completeAdminDirect({ userId, trackIds, stateVersion, paymentConfirmed = false, now = new Date() }) {
  const selected = normalizeTrackIds(trackIds);
  if (paymentConfirmed !== true) throw new ValidationError("Confirm that payment was handled externally");
  const requestedVersion = version(stateVersion);
  return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (transaction) => {
    const season = await LeagueSeason.findOne({ where: { open_slot: 1 }, transaction, lock: transaction.LOCK.UPDATE });
    if (!season || season.state !== "ACTIVE" || season.current_week !== 2) throw new ConflictError("Week 2 buyback administration is unavailable");
    await requireStoredAdminWindow({ season, now, transaction });
    const decision = await materializeLocked({ userId: Number(userId), season, now, transaction });
    if (!decision) throw new ConflictError("No eligible buyback opportunity exists");
    if (decision.status === "COMPLETED_ADMIN_DIRECT") {
      const existing = (await BuybackDecisionTrack.findAll({ where: { buyback_decision_id: decision.id }, transaction })).map((row) => row.track_id).sort((a, b) => a - b);
      if (JSON.stringify(existing) === JSON.stringify(selected)) return { idempotent: true, status: decision.status, stateVersion: decision.state_version };
    }
    if (decision.status !== "ELIGIBLE" || decision.state_version !== requestedVersion) throw new ConflictError("Buyback decision changed; reload before continuing");
    const { eligible } = await seasonTracks({ userId: decision.user_id, season, transaction });
    if (selected.some((id) => !eligible.some((item) => item.trackId === id))) throw new ConflictError("Every selected Track must remain eligible");
    const audit = await auditAdmin({ action: "COMPLETE_DIRECT_BUYBACK", season, decision, summary: { fulfilledCount: selected.length, totalCents: selected.length * BUYBACK_PRICE_CENTS }, now, transaction });
    for (const id of selected) {
      const item = eligible.find((candidate) => candidate.trackId === id);
      const track = await Track.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      const pick = await Pick.findByPk(item.pickId, { transaction, lock: transaction.LOCK.UPDATE });
      const reactivation = await reactivate({ track, pick, season, audit, transaction });
      await BuybackDecisionTrack.create({ buyback_decision_id: decision.id, track_id: id, week_one_pick_id: pick.id, resolution: "FULFILLED", track_reactivation_id: reactivation.id }, { transaction });
    }
    await decision.update({ status: "COMPLETED_ADMIN_DIRECT", origin: "ADMIN", resolved_at: now, admin_audit_operation_id: audit.id, state_version: decision.state_version + 1 }, { transaction });
    return { idempotent: false, status: decision.status, stateVersion: decision.state_version, fulfilledTrackIds: selected };
  });
}

async function listAdmin({ view = "pending" }) {
  const season = await LeagueSeason.findOne({ where: { open_slot: 1 } });
  if (!season) return [];
  if (view === "eligible") {
    const schedule = await ScheduleSnapshot.findOne({ where: { league_season_id: season.id, week: 2, provider: season.schedule_phase === "PRESEASON" ? "ESPN" : "FIXTURE_DOWNLOAD" }, order: [["fetched_at", "DESC"]] });
    const kickoffs = schedule?.normalized_schedule?.games?.map((game) => new Date(game.kickoff)).filter((date) => !Number.isNaN(date.getTime())) || [];
    const deadline = kickoffs.length ? new Date(Math.min(...kickoffs.map((date) => date.getTime()))) : null;
    const users = await User.findAll({ attributes: ["id"] });
    for (const user of users) await getUserBuyback({ userId: user.id, deadlineAvailable: Boolean(deadline), deadline, now: new Date() });
  }
  const status = view === "history" ? { [Op.in]: [...TERMINAL] } : view === "eligible" ? "ELIGIBLE" : "PENDING_USER_REQUEST";
  const rows = await BuybackDecision.findAll({ where: { league_season_id: season.id, status }, include: [{ model: User, as: "user", attributes: ["id", "first_name", "last_name", "username"] }], order: [[view === "history" ? "resolved_at" : "created_at", "DESC"]] });
  return Promise.all(rows.map(async (row) => {
    let tracks = await childViews(row);
    if (row.status === "ELIGIBLE") tracks = (await seasonTracks({ userId: row.user_id, season, lock: false })).eligible.map((item) => ({ ...item, resolution: null }));
    return { id: row.id, status: row.status, stateVersion: row.state_version, requestedAt: row.requested_at, resolvedAt: row.resolved_at, user: { id: row.user.id, displayName: `${row.user.first_name} ${row.user.last_name}`.trim(), username: row.user.username }, tracks };
  }));
}

module.exports = { getUserBuyback, decide, assertPickAllowedLocked, expireAtDeadlineLocked, resolveAdmin, completeAdminDirect, listAdmin, materializeLocked };
