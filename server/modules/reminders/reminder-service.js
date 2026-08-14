const { LeagueSeason } = require("../../../models");
const { getPickRemindersAccess } = require("../../features/feature-access-service");
const { automaticWindowState, evaluateReminderEligibility, manualCampaignWarnings } = require("./reminder-policy");
const { ConflictError } = require("../../lib/errors");
const { nextDeliveryState, providerIntent } = require("./reminder-delivery-policy");
const defaultRepository = require("./reminder-repository");

function createReminderService({
  repository = defaultRepository,
  loadAuthoritativeContext,
  getAccess = getPickRemindersAccess,
  providers = {},
  configuration,
  now = () => new Date(),
  logger = { info() {}, warn() {} },
}) {
  const channelAvailable = (channel) => configuration.pickRemindersSystemAvailable === true
    && (channel === "EMAIL" ? configuration.pickRemindersEmailDeliveryAvailable : configuration.pickRemindersPushDeliveryAvailable) === true;

  async function eligibleChannels({ season, deadline, candidate, currentTime, transaction }) {
    const access = await getAccess({ userId: candidate.userId, systemAvailable: configuration.pickRemindersSystemAvailable, transaction });
    return ["EMAIL", "PUSH"].filter((channel) => evaluateReminderEligibility({
      now: currentTime, deadline, effectiveAccess: access.effective,
      channelEnabled: channel === "EMAIL" ? candidate.emailEnabled : candidate.pushEnabled,
      channelAvailable: channelAvailable(channel), seasonState: season.state,
      round: season.current_week, schedulePhase: season.schedule_phase,
      activeTrackCount: candidate.activeTrackCount, missingPickCount: candidate.missingPickCount,
    }).eligible);
  }

  async function buildCandidates({ season, deadline, currentTime, transaction }) {
    const candidates = await repository.listCandidateViews({ season, transaction });
    const deliveries = [];
    for (const candidate of candidates) {
      for (const channel of await eligibleChannels({ season, deadline, candidate, currentTime, transaction })) deliveries.push({ userId: candidate.userId, channel });
    }
    return { evaluated: candidates.length, deliveries };
  }

  async function evaluateAutomatic() {
    if (configuration.pickRemindersSystemAvailable !== true) return { status: "UNAVAILABLE", nextCheckAt: null, evaluated: 0, eligible: 0 };
    const context = await loadAuthoritativeContext();
    const currentTime = now();
    if (!context?.season || context.season.state !== "ACTIVE" || context.season.current_week < 1) return { status: "NOT_DUE", nextCheckAt: null, evaluated: 0, eligible: 0 };
    const state = automaticWindowState({ now: currentTime, deadline: context.deadline });
    if (state === "NOT_DUE") return { status: "NOT_DUE", nextCheckAt: new Date(context.deadline.getTime() - 24 * 60 * 60 * 1000), evaluated: 0, eligible: 0 };
    if (state === "CLOSED") return { status: "CLOSED", nextCheckAt: null, evaluated: 0, eligible: 0 };
    const { evaluated, deliveries } = await buildCandidates({ season: context.season, deadline: context.deadline, currentTime });
    const campaign = await repository.createCampaignWithDeliveries({ season: context.season, deadline: context.deadline, kind: "AUTOMATIC", candidates: deliveries, evaluated, now: currentTime });
    const summary = { status: campaign.created ? "CREATED" : "ALREADY_CREATED", nextCheckAt: context.deadline, evaluated, eligible: deliveries.length };
    logger.info("reminder_evaluation_completed", summary);
    return summary;
  }

  async function processDue({ limit = 100 } = {}) {
    const counts = { claimed: 0, accepted: 0, unknown: 0, temporarilyFailed: 0, permanentlyFailed: 0, suppressed: 0, retryExhausted: 0 };
    for (let index = 0; index < limit; index += 1) {
      const preClaimContext = await loadAuthoritativeContext();
      const claimTime = now();
      const claim = await repository.claimNext({ now: claimTime, validate: async ({ delivery, transaction }) => {
        const sameRound = preClaimContext?.season?.id === delivery.campaign.league_season_id && preClaimContext.season.current_week === delivery.campaign.round && preClaimContext.season.schedule_phase === delivery.campaign.schedule_phase;
        if (!sameRound) return { eligible: false, reason: "ROUND_CHANGED" };
        const candidate = await repository.loadCandidateView({ season: preClaimContext.season, userId: delivery.user_id, transaction });
        const channels = await eligibleChannels({ season: preClaimContext.season, deadline: preClaimContext.deadline, candidate, currentTime: now(), transaction });
        return { eligible: channels.includes(delivery.channel), reason: "INELIGIBLE" };
      } });
      if (!claim) break;
      if (claim.recoveredUnknown) { counts.unknown += 1; continue; }
      if (claim.suppressed) { counts.suppressed += 1; continue; }
      counts.claimed += 1;
      const context = await loadAuthoritativeContext();
      const attemptTime = now();
      const sameRound = context?.season?.id === claim.campaign.leagueSeasonId && context.season.current_week === claim.campaign.round && context.season.schedule_phase === claim.campaign.schedulePhase;
      const candidate = sameRound ? await repository.loadCandidateView({ season: context.season, userId: claim.userId }) : null;
      const channels = candidate ? await eligibleChannels({ season: context.season, deadline: context.deadline, candidate, currentTime: attemptTime }) : [];
      if (!sameRound || !channels.includes(claim.channel)) {
        await repository.finishClaim({ claim, state: "SUPPRESSED", now: attemptTime, suppressionReason: "INELIGIBLE" });
        counts.suppressed += 1;
        continue;
      }
      const provider = providers[claim.channel];
      if (!provider) {
        await repository.finishClaim({ claim, state: "SUPPRESSED", now: attemptTime, suppressionReason: "PROVIDER_UNAVAILABLE" });
        counts.suppressed += 1;
        continue;
      }
      let outcome;
      try { ({ outcome } = await provider.send(providerIntent(claim.channel), { claim, context, now: attemptTime })); }
      catch (error) { logger.warn("reminder_provider_result_unknown", { channel: claim.channel, reason: error.code || error.name }); outcome = "UNKNOWN"; }
      const result = nextDeliveryState({ outcome, attemptCount: claim.attemptCount + 1 });
      await repository.finishClaim({ claim, state: result.state, now: now(), retryDelayMs: result.retryDelayMs });
      if (result.state === "ACCEPTED") counts.accepted += 1;
      else if (result.state === "UNKNOWN") counts.unknown += 1;
      else if (result.state === "TEMPORARILY_FAILED") counts.temporarilyFailed += 1;
      else if (result.state === "PERMANENTLY_FAILED") counts.permanentlyFailed += 1;
      else if (result.state === "RETRY_EXHAUSTED") counts.retryExhausted += 1;
    }
    logger.info("reminder_delivery_completed", counts);
    return counts;
  }

  async function buildManualCampaignContext({ transaction } = {}) {
    if (configuration.pickRemindersSystemAvailable !== true || configuration.pickRemindersAdminCampaignAvailable !== true) throw new ConflictError("Pick Reminders manual campaigns are unavailable");
    const context = await loadAuthoritativeContext();
    const currentTime = now();
    if (!context?.season || context.season.state !== "ACTIVE" || context.season.current_week < 1 || currentTime >= context.deadline) throw new ConflictError("Pick submission is not open");
    const { evaluated, deliveries } = await buildCandidates({ season: context.season, deadline: context.deadline, currentTime, transaction });
    const automaticConsumedAt = await repository.getAutomaticConsumedAt({ season: context.season, transaction });
    const automaticDueAt = new Date(context.deadline.getTime() - 24 * 60 * 60 * 1000);
    return {
      season: context.season, deadline: context.deadline, scheduleHash: context.scheduleHash, currentTime, evaluated, deliveries,
      counts: { email: deliveries.filter(({ channel }) => channel === "EMAIL").length, push: deliveries.filter(({ channel }) => channel === "PUSH").length },
      warnings: manualCampaignWarnings({ now: currentTime, automaticDueAt, automaticConsumedAt }),
    };
  }

  async function cleanup({ limit = 100 } = {}) {
    const seasons = await LeagueSeason.findAll({ order: [["year", "DESC"]], limit: 2, attributes: ["id"] });
    const [historyDeleted, preferencesDeleted] = await Promise.all([
      repository.deleteHistoryBeforeSeasonIds({ retainedSeasonIds: seasons.map(({ id }) => id), limit }),
      repository.deleteExpiredPreferences({ now: now(), limit }),
    ]);
    const result = { historyDeleted, preferencesDeleted, limit };
    logger.info("reminder_cleanup_completed", result);
    return result;
  }

  async function getOperationalStatus() {
    const seasons = await LeagueSeason.findAll({ order: [["year", "DESC"]], limit: 2, attributes: ["id"] });
    return { counts: await repository.getOperationalCounts({ retainedSeasonIds: seasons.map(({ id }) => id) }) };
  }

  return { buildCandidates, buildManualCampaignContext, cleanup, evaluateAutomatic, getOperationalStatus, processDue };
}

module.exports = { createReminderService };
