const { Op } = require("sequelize");
const { LeagueSeason, Track, Pick, TrackReactivation, BuybackDecision, BuybackDecisionTrack, ScheduleSnapshot, Team, LeaguePotAdjustment } = require("../../../models");
const { ConflictError, ValidationError, NotFoundError } = require("../../lib/errors");
const { getPotTotals } = require("../pot/pot-service");
const { planTrackProjection } = require("./repair-policy");

function correctionWindow(season, schedule, now = new Date()) {
  if (!season || season.state !== "ACTIVE" || season.preseason_complete) return "An active weekly round is required";
  const games = schedule?.normalized_schedule?.games;
  if (!games?.length || games.some(game => !game.kickoff || !Number.isFinite(new Date(game.kickoff).getTime()))) return "A validated current-week schedule is required";
  if (now >= new Date(Math.min(...games.map(game => new Date(game.kickoff).getTime())))) return "Correction is closed at kickoff; wait until the next week opens";
  return null;
}

const positiveId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const trackState = track => ({ userId: track.user_id, leagueSeasonId: track.league_season_id, currentPick: track.current_pick, usedPicks: track.used_picks, availablePicks: track.available_picks, wrongPick: track.wrong_pick, eliminatedByPickId: track.eliminated_by_pick_id, stateVersion: track.state_version });
const pickState = pick => ({ week: pick.week, teamName: pick.team_name, outcome: pick.outcome, pickCycle: pick.pick_cycle, stateVersion: pick.state_version });

async function buildEliminationCorrection(input, transaction, lock, options = {}) {
  if (!positiveId(input.trackId) || !positiveId(input.pickId)) throw new ValidationError("Select a Track and its historical Wrong Pick");
  if (!["REVERSE", "KEEP_TOTAL"].includes(input.potTreatment)) throw new ValidationError("Choose how this correction affects the pot");
  if (typeof input.explanation !== "string" || !input.explanation.trim() || input.explanation.trim().length > 500) throw new ValidationError("A correction explanation of at most 500 characters is required");
  const query = { transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) };
  const season = await LeagueSeason.findOne({ where: { open_slot: 1 }, ...query });
  if (!season) throw new ConflictError("An active League Season is required");
  const schedule = await ScheduleSnapshot.findOne({ where: { league_season_id: season.id, week: season.current_week, provider: season.schedule_phase === "PRESEASON" ? "ESPN" : "FIXTURE_DOWNLOAD" }, order: [["fetched_at", "DESC"], ["id", "DESC"]], ...query });
  const now = typeof options.now === "function" ? options.now() : options.now || new Date();
  const closed = correctionWindow(season, schedule, now);
  if (closed) throw new ConflictError(closed);
  const track = await Track.findByPk(Number(input.trackId), query);
  if (!track || track.league_season_id !== season.id) throw new NotFoundError("Track not found in the open League Season");
  const picks = await Pick.findAll({ where: { track_id: track.id, league_season_id: season.id }, order: [["week", "ASC"], ["id", "ASC"]], ...query });
  const selected = picks.find(pick => pick.id === Number(input.pickId));
  if (!selected || selected.outcome !== "WRONG_PICK" || selected.week >= season.current_week) throw new ValidationError("Select an existing historical Wrong Pick from this Track");
  if (track.eliminated_by_pick_id === selected.id) throw new ConflictError("Track is already eliminated by this Pick");
  const reactivations = await TrackReactivation.findAll({ where: { track_id: track.id, league_season_id: season.id }, order: [["id", "ASC"]], ...query });
  const earlierWrong = picks.find(pick => pick.week < selected.week && pick.outcome === "WRONG_PICK" && !reactivations.some(event => event.waived_pick_id === pick.id));
  if (earlierWrong) throw new ConflictError("An earlier Wrong Pick already eliminates this Track");
  const affectedIds = picks.filter(pick => pick.week >= selected.week).map(pick => pick.id);
  const reversed = reactivations.filter(event => affectedIds.includes(event.waived_pick_id));
  if (!reversed.some(event => event.waived_pick_id === selected.id)) throw new ConflictError("Selected Wrong Pick has no active reactivation to reverse");
  const members = await BuybackDecisionTrack.findAll({ where: { track_id: track.id, week_one_pick_id: { [Op.in]: affectedIds }, reversed_by_operation_id: null }, order: [["id", "ASC"]], ...query });
  const decisions = members.length ? await BuybackDecision.findAll({ where: { id: { [Op.in]: [...new Set(members.map(member => member.buyback_decision_id))] } }, ...query }) : [];
  if (decisions.some(decision => decision.user_id !== track.user_id || decision.league_season_id !== season.id)) throw new ConflictError("Buyback membership does not match this Track");
  if (decisions.some(decision => ["ELIGIBLE", "PENDING_USER_REQUEST"].includes(decision.status))) throw new ConflictError("Resolve the pending buyback decision before correcting this Track");
  const league = await getPotTotals({ seasonId: season.id, transaction });
  const user = await getPotTotals({ seasonId: season.id, userId: track.user_id, transaction });
  const contribution = await getPotTotals({ seasonId: season.id, trackId: track.id, transaction });
  const counted = members.some(member => member.resolution === "FULFILLED" && decisions.some(decision => decision.id === member.buyback_decision_id && ["COMPLETED_USER_REQUEST", "COMPLETED_ADMIN_DIRECT"].includes(decision.status))) ? contribution.buybackCount : 0;
  const removedCents = counted * 1000;
  const adjustmentCents = input.potTreatment === "KEEP_TOTAL" ? removedCents : 0;
  const after = before => ({ ...before, buybackCount: before.buybackCount - counted, buybackCents: before.buybackCents - removedCents, adjustmentCents: before.adjustmentCents + adjustmentCents, totalCents: before.totalCents - removedCents + adjustmentCents });
  const potImpact = { before: { user, league }, after: { user: after(user), league: after(league) }, deltaCents: adjustmentCents - removedCents, adjustmentCents };
  const later = picks.filter(pick => pick.week > selected.week);
  const teams = await Team.findAll({ attributes: ["team_name"], order: [["id", "ASC"]], transaction });
  const projection = planTrackProjection({ season: { state: season.state, currentWeek: season.current_week, pickCycle: season.pick_cycle }, picks: picks.filter(pick => pick.week <= selected.week).map(pick => ({ id: pick.id, ...pickState(pick) })), waivedPickIds: reactivations.filter(event => !reversed.includes(event)).map(event => event.waived_pick_id), teamNames: teams.map(team => team.team_name) });
  const normalizedIntent = { trackId: track.id, pickId: selected.id, potTreatment: input.potTreatment, explanation: input.explanation.trim() };
  const before = { ...trackState(track), reactivations: reversed.map(event => ({ id: event.id, waivedPickId: event.waived_pick_id })), buybacks: members.map(member => ({ id: member.id, resolution: member.resolution, reactivationId: member.track_reactivation_id })), decisions: decisions.map(decision => ({ id: decision.id, status: decision.status, stateVersion: decision.state_version })).sort((a, b) => a.id - b.id), pot: potImpact.before };
  return {
    normalizedIntent, leagueSeason: season, scheduleHash: schedule.content_hash, undoable: false,
    description: `Restore Track ${track.id} elimination from Week ${selected.week} ${selected.team_name}`,
    warnings: ["Later Picks become void and remain in history. This correction cannot be undone."], potImpact,
    targets: [{ targetType: "TRACK", targetId: track.id, beforeState: before, afterState: { ...projection, stateVersion: track.state_version + 1, reversedReactivationIds: reversed.map(event => event.id), reversedBuybackIds: members.map(member => member.id), pot: potImpact.after } }, { targetType: "PICK", targetId: selected.id, beforeState: pickState(selected), afterState: pickState(selected) }, ...later.map(pick => ({ targetType: "PICK", targetId: pick.id, beforeState: pickState(pick), afterState: { ...pickState(pick), voided: true, stateVersion: pick.state_version + 1 } }))],
    plan: { track, later, reversed, members, decisions, projection, adjustmentCents },
  };
}

async function commitEliminationCorrection(built, operation, transaction) {
  const { track, later, reversed, members, decisions, projection, adjustmentCents } = built.plan;
  for (const pick of later) await pick.update({ voided_by_operation_id: operation.id, state_version: pick.state_version + 1 }, { transaction });
  for (const event of reversed) await event.update({ reversed_by_operation_id: operation.id }, { transaction });
  for (const member of members) await member.update({ reversed_by_operation_id: operation.id }, { transaction });
  for (const decision of decisions) await decision.update({ state_version: decision.state_version + 1 }, { transaction });
  await track.update({ current_pick: projection.currentPick, used_picks: projection.usedPicks, available_picks: projection.availablePicks, wrong_pick: projection.wrongPick, eliminated_by_pick_id: projection.eliminatedByPickId, state_version: track.state_version + 1 }, { transaction });
  if (adjustmentCents) await LeaguePotAdjustment.create({ league_season_id: built.leagueSeason.id, user_id: track.user_id, track_id: track.id, admin_audit_operation_id: operation.id, amount_cents: adjustmentCents, explanation: built.normalizedIntent.explanation }, { transaction });
}
module.exports = { correctionWindow, buildEliminationCorrection, commitEliminationCorrection };
