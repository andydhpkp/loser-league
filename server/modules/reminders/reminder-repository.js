const { Op, Transaction } = require("sequelize");
const {
  sequelize, User, Track, Pick, LeagueSeason, ReminderPreference,
  ReminderCampaign, ReminderDelivery, UserFeatureAccessState, PushSubscription,
  EmailReminderVerification, EmailVerificationRequest, EmailOptOutToken,
} = require("../../../models");

const CLAIM_LEASE_MS = 2 * 60 * 1000;

async function loadRoundContext({ transaction, lock = false } = {}) {
  return LeagueSeason.findOne({ where: { open_slot: 1 }, transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
}

async function listCandidateViews({ season, transaction }) {
  const users = await User.findAll({ attributes: ["id"], include: [
    { model: ReminderPreference, as: "reminderPreference", required: true, attributes: ["email_enabled", "push_enabled"] },
    { model: Track, required: true, attributes: ["id", "eliminated_by_pick_id"], where: { league_season_id: season.id, eliminated_by_pick_id: null }, include: [{ model: Pick, as: "picks", required: false, attributes: ["id", "week"], where: { league_season_id: season.id, week: season.current_week } }] },
  ], transaction });
  return users.map((user) => {
    const tracks = user.tracks || [];
    return {
      userId: user.id,
      emailEnabled: user.reminderPreference.email_enabled === true,
      pushEnabled: user.reminderPreference.push_enabled === true,
      activeTrackCount: tracks.length,
      missingPickCount: tracks.filter((track) => !track.picks?.length).length,
    };
  });
}

async function loadCandidateView({ season, userId, transaction }) {
  const user = await User.findByPk(userId, { attributes: ["id"], include: [
    { model: ReminderPreference, as: "reminderPreference", required: true, attributes: ["email_enabled", "push_enabled"] },
    { model: Track, required: true, attributes: ["id", "eliminated_by_pick_id"], where: { league_season_id: season.id, eliminated_by_pick_id: null }, include: [{ model: Pick, as: "picks", required: false, attributes: ["id", "week"], where: { league_season_id: season.id, week: season.current_week } }] },
  ], transaction });
  if (!user) return { userId, emailEnabled: false, pushEnabled: false, activeTrackCount: 0, missingPickCount: 0 };
  const tracks = user.tracks || [];
  return { userId, emailEnabled: user.reminderPreference.email_enabled === true, pushEnabled: user.reminderPreference.push_enabled === true, activeTrackCount: tracks.length, missingPickCount: tracks.filter((track) => !track.picks?.length).length };
}

async function createCampaignWithDeliveries({ season, deadline, kind, candidates, evaluated = 0, now, auditOperationId = null, transaction: suppliedTransaction }) {
  const work = async (transaction) => {
    const [campaign, created] = await ReminderCampaign.findOrCreate({
      where: { league_season_id: season.id, schedule_phase: season.schedule_phase, round: season.current_week, kind, window_key: kind === "AUTOMATIC" ? "FIXED_24_HOUR_V1" : "ONE_PER_ROUND_V1" },
      defaults: { authoritative_deadline: deadline, state: "OPEN", evaluated_count: evaluated, eligible_count: candidates.length, admin_audit_operation_id: auditOperationId }, transaction,
    });
    for (const { userId, channel } of created ? candidates : []) {
      await ReminderDelivery.findOrCreate({
        where: { reminder_campaign_id: campaign.id, user_id: userId, channel },
        defaults: { state: "PENDING", next_attempt_at: now },
        transaction,
      });
    }
    return { campaign, created, deliveryCount: await ReminderDelivery.count({ where: { reminder_campaign_id: campaign.id }, transaction }) };
  };
  return suppliedTransaction ? work(suppliedTransaction) : sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, work);
}

async function claimNext({ now, validate = async () => ({ eligible: true }) }) {
  return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (transaction) => {
    const expiredClaim = await ReminderDelivery.findOne({ where: { state: "CLAIMED", claimed_until: { [Op.lte]: now } }, order: [["id", "ASC"]], transaction, lock: transaction.LOCK.UPDATE, skipLocked: true });
    if (expiredClaim) {
      await expiredClaim.update({ state: "UNKNOWN", claimed_until: null, next_attempt_at: null, consumed_at: now }, { transaction });
      return { recoveredUnknown: true };
    }
    const delivery = await ReminderDelivery.findOne({
      where: {
        [Op.or]: [
          { state: "PENDING", next_attempt_at: { [Op.lte]: now } },
          { state: "TEMPORARILY_FAILED", next_attempt_at: { [Op.lte]: now } },
        ],
      }, include: [{ model: ReminderCampaign, as: "campaign" }], order: [["id", "ASC"]], transaction, lock: transaction.LOCK.UPDATE, skipLocked: true,
    });
    if (!delivery) return null;
    const validation = await validate({ delivery, transaction });
    if (validation.defer === true) return { deferred: true };
    if (validation.eligible !== true) {
      await delivery.update({ state: "SUPPRESSED", claimed_until: null, next_attempt_at: null, consumed_at: now, suppression_reason: validation.reason || "INELIGIBLE" }, { transaction });
      return { suppressed: true };
    }
    await delivery.update({ state: "CLAIMED", claimed_until: new Date(now.getTime() + CLAIM_LEASE_MS), claim_version: delivery.claim_version + 1, claimed_count: (delivery.claimed_count || 0) + 1 }, { transaction });
    return { id: delivery.id, claimVersion: delivery.claim_version, userId: delivery.user_id, channel: delivery.channel, campaign: { id: delivery.campaign.id, leagueSeasonId: delivery.campaign.league_season_id, schedulePhase: delivery.campaign.schedule_phase, round: delivery.campaign.round }, attemptCount: delivery.attempt_count };
  });
}

async function finishClaim({ claim, state, now, retryDelayMs = null, suppressionReason = null }) {
  const [updated] = await ReminderDelivery.update({
    state, attempt_count: claim.attemptCount + (state === "SUPPRESSED" ? 0 : 1), claimed_until: null,
    last_attempt_at: state === "SUPPRESSED" ? null : now,
    next_attempt_at: retryDelayMs === null ? null : new Date(now.getTime() + retryDelayMs),
    consumed_at: ["ACCEPTED", "UNKNOWN", "PERMANENTLY_FAILED", "SUPPRESSED", "RETRY_EXHAUSTED"].includes(state) ? now : null,
    suppression_reason: suppressionReason,
    ...(state === "TEMPORARILY_FAILED" ? { temporary_failure_count: sequelize.literal("temporary_failure_count + 1") } : {}),
  }, { where: { id: claim.id, state: "CLAIMED", claim_version: claim.claimVersion } });
  return updated === 1;
}

async function deferClaim({ claim }) {
  const [updated] = await ReminderDelivery.update({ state: claim.attemptCount > 0 ? "TEMPORARILY_FAILED" : "PENDING", claimed_until: null }, { where: { id: claim.id, state: "CLAIMED", claim_version: claim.claimVersion } });
  return updated === 1;
}

async function deleteHistoryBeforeSeasonIds({ retainedSeasonIds, limit = 100 }) {
  return sequelize.transaction(async (transaction) => {
    const campaigns = await ReminderCampaign.findAll({ where: { league_season_id: { [Op.notIn]: retainedSeasonIds.length ? retainedSeasonIds : [0] } }, attributes: ["id"], order: [["id", "ASC"]], limit, transaction, lock: transaction.LOCK.UPDATE });
    const campaignIds = campaigns.map(({ id }) => id);
    if (!campaignIds.length) return 0;
    const deliveries = await ReminderDelivery.findAll({ where: { reminder_campaign_id: campaignIds }, attributes: ["id"], order: [["id", "ASC"]], limit, transaction, lock: transaction.LOCK.UPDATE });
    const deliveryIds = deliveries.map(({ id }) => id);
    if (deliveryIds.length) await ReminderDelivery.destroy({ where: { id: deliveryIds }, transaction });
    let deleted = deliveryIds.length;
    for (const campaignId of campaignIds) {
      if (deleted >= limit) break;
      if (await ReminderDelivery.count({ where: { reminder_campaign_id: campaignId }, transaction }) === 0) {
        deleted += await ReminderCampaign.destroy({ where: { id: campaignId }, transaction });
      }
    }
    return deleted;
  });
}

async function deleteExpiredPreferences({ now, limit = 100 }) {
  return sequelize.transaction(async (transaction) => {
    const expired = await UserFeatureAccessState.findAll({ where: { feature_key: "PICK_REMINDERS", grace_expires_at: { [Op.lte]: now } }, attributes: ["user_id"], order: [["grace_expires_at", "ASC"]], limit, transaction, lock: transaction.LOCK.UPDATE });
    const userIds = expired.map(({ user_id: userId }) => userId);
    if (!userIds.length) return 0;
    const subscriptionsDeleted = await PushSubscription.destroy({ where: { user_id: userIds }, transaction });
    const emailVerificationRequestsDeleted = await EmailVerificationRequest.destroy({ where: { user_id: userIds }, transaction });
    const emailOptOutTokensDeleted = await EmailOptOutToken.destroy({ where: { user_id: userIds }, transaction });
    const emailVerificationsDeleted = await EmailReminderVerification.destroy({ where: { user_id: userIds }, transaction });
    const deleted = await ReminderPreference.destroy({ where: { user_id: userIds }, transaction });
    await UserFeatureAccessState.destroy({ where: { user_id: userIds, feature_key: "PICK_REMINDERS", grace_expires_at: { [Op.lte]: now } }, transaction });
    return deleted + subscriptionsDeleted + emailVerificationRequestsDeleted + emailOptOutTokensDeleted + emailVerificationsDeleted;
  });
}

async function getAutomaticConsumedAt({ season, transaction }) {
  const campaign = await ReminderCampaign.findOne({ where: { league_season_id: season.id, schedule_phase: season.schedule_phase, round: season.current_week, kind: "AUTOMATIC", window_key: "FIXED_24_HOUR_V1" }, attributes: ["id"], transaction });
  if (!campaign) return null;
  const delivery = await ReminderDelivery.findOne({ where: { reminder_campaign_id: campaign.id, state: "ACCEPTED" }, attributes: ["consumed_at"], order: [["consumed_at", "DESC"]], transaction });
  return delivery?.consumed_at || null;
}

async function getOperationalCounts({ retainedSeasonIds }) {
  const campaigns = await ReminderCampaign.findAll({ where: { league_season_id: retainedSeasonIds }, attributes: ["evaluated_count", "eligible_count"] });
  const grouped = await ReminderDelivery.count({ include: [{ model: ReminderCampaign, as: "campaign", required: true, where: { league_season_id: retainedSeasonIds }, attributes: [] }], group: ["state"] });
  const durable = await ReminderDelivery.findAll({ include: [{ model: ReminderCampaign, as: "campaign", required: true, where: { league_season_id: retainedSeasonIds }, attributes: [] }], attributes: [[sequelize.fn("SUM", sequelize.col("reminder_delivery.claimed_count")), "claimed"], [sequelize.fn("SUM", sequelize.col("reminder_delivery.temporary_failure_count")), "retried"]], raw: true });
  const byState = Object.fromEntries(grouped.map(({ state, count }) => [state, Number(count)]));
  return {
    evaluated: campaigns.reduce((sum, campaign) => sum + campaign.evaluated_count, 0),
    eligible: campaigns.reduce((sum, campaign) => sum + campaign.eligible_count, 0),
    claimed: Number(durable[0]?.claimed || 0),
    accepted: byState.ACCEPTED || 0,
    unknown: byState.UNKNOWN || 0,
    temporarilyFailed: byState.TEMPORARILY_FAILED || 0,
    retried: Number(durable[0]?.retried || 0),
    permanentlyFailed: byState.PERMANENTLY_FAILED || 0,
    suppressed: byState.SUPPRESSED || 0,
    retryExhausted: byState.RETRY_EXHAUSTED || 0,
  };
}

module.exports = { CLAIM_LEASE_MS, createCampaignWithDeliveries, claimNext, deferClaim, deleteExpiredPreferences, deleteHistoryBeforeSeasonIds, finishClaim, getAutomaticConsumedAt, getOperationalCounts, listCandidateViews, loadCandidateView, loadRoundContext };
