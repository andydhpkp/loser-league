const assert = require("node:assert/strict");
const test = require("node:test");
const { createReminderService } = require("../../server/modules/reminders/reminder-service");
const { createFakeReminderProvider } = require("../../server/modules/reminders/fake-reminder-provider");
const { LeagueSeason } = require("../../models");

const season = { id: 4, year: 2026, state: "ACTIVE", current_week: 3, schedule_phase: "REGULAR" };
const deadline = new Date("2026-09-11T00:00:00Z");
const configuration = { pickRemindersSystemAvailable: true, pickRemindersEmailDeliveryAvailable: true, pickRemindersPushDeliveryAvailable: true, pickRemindersAdminCampaignAvailable: true };

function repository(overrides = {}) {
  return {
    listCandidateViews: async () => [{ userId: 7, emailEnabled: true, pushEnabled: true, activeTrackCount: 2, missingPickCount: 1 }],
    createCampaignWithDeliveries: async ({ candidates }) => ({ created: true, deliveryCount: candidates.length }),
    claimNext: async () => null,
    loadCandidateView: async () => ({ userId: 7, emailEnabled: true, pushEnabled: false, activeTrackCount: 1, missingPickCount: 1 }),
    finishClaim: async () => true,
    deleteHistoryBeforeSeasonIds: async () => 0,
    deleteExpiredPreferences: async () => 0,
    getAutomaticConsumedAt: async () => null,
    getOperationalCounts: async () => ({}),
    ...overrides,
  };
}

test("automatic evaluation catches up once and creates all eligible personalized channels", async () => {
  let created;
  const service = createReminderService({ repository: repository({ createCampaignWithDeliveries: async (input) => { created = input; return { created: true, deliveryCount: input.candidates.length }; } }), loadAuthoritativeContext: async () => ({ season, deadline }), getAccess: async () => ({ effective: true }), configuration, now: () => new Date("2026-09-10T12:00:00Z") });
  const result = await service.evaluateAutomatic();
  assert.equal(result.status, "CREATED");
  assert.deepEqual(created.candidates, [{ userId: 7, channel: "EMAIL" }, { userId: 7, channel: "PUSH" }]);
  assert.equal(Object.hasOwn(created, "message"), false);
});

test("automatic evaluation logs campaign creation but suppresses unchanged recovery passes", async () => {
  const events = [];
  let created = true;
  const service = createReminderService({
    repository: repository({
      createCampaignWithDeliveries: async ({ candidates }) => {
        const wasCreated = created;
        created = false;
        return { created: wasCreated, deliveryCount: candidates.length };
      },
    }),
    loadAuthoritativeContext: async () => ({ season, deadline }),
    getAccess: async () => ({ effective: true }),
    configuration,
    logger: { info: (event, context) => events.push({ event, context }), warn() {} },
    now: () => new Date("2026-09-10T12:00:00Z"),
  });

  assert.equal((await service.evaluateAutomatic()).status, "CREATED");
  assert.equal((await service.evaluateAutomatic()).status, "ALREADY_CREATED");
  assert.deepEqual(events, [{
    event: "reminder_evaluation_completed",
    context: { status: "CREATED", nextCheckAt: deadline, evaluated: 1, eligible: 2 },
  }]);
});

test("a retry rechecks eligibility and suppresses before provider invocation", async () => {
  const finished = [];
  let claims = 0;
  const provider = createFakeReminderProvider();
  const service = createReminderService({ repository: repository({ claimNext: async () => claims++ === 0 ? { id: 1, claimVersion: 2, userId: 7, channel: "EMAIL", attemptCount: 1, campaign: { leagueSeasonId: 4, schedulePhase: "REGULAR", round: 3 } } : null, loadCandidateView: async () => ({ userId: 7, emailEnabled: false, pushEnabled: false, activeTrackCount: 1, missingPickCount: 1 }), finishClaim: async (value) => { finished.push(value); return true; } }), loadAuthoritativeContext: async () => ({ season, deadline }), getAccess: async () => ({ effective: true }), providers: { EMAIL: provider }, configuration, now: () => new Date("2026-09-10T12:00:00Z") });
  const result = await service.processDue();
  assert.equal(result.suppressed, 1);
  assert.equal(provider.attempts.length, 0);
  assert.equal(finished[0].state, "SUPPRESSED");
});

test("ambiguous provider results become unknown without retry", async () => {
  const finished = [];
  let claims = 0;
  const service = createReminderService({ repository: repository({ claimNext: async () => claims++ === 0 ? { id: 1, claimVersion: 1, userId: 7, channel: "EMAIL", attemptCount: 0, campaign: { leagueSeasonId: 4, schedulePhase: "REGULAR", round: 3 } } : null, finishClaim: async (value) => { finished.push(value); return true; } }), loadAuthoritativeContext: async () => ({ season, deadline }), getAccess: async () => ({ effective: true }), providers: { EMAIL: createFakeReminderProvider(["UNKNOWN"]) }, configuration, now: () => new Date("2026-09-10T12:00:00Z") });
  assert.equal((await service.processDue()).unknown, 1);
  assert.equal(finished[0].state, "UNKNOWN");
  assert.equal(finished[0].retryDelayMs, null);
});

test("expired ambiguous claims are counted unknown without provider invocation", async () => {
  let claims = 0; const provider = createFakeReminderProvider();
  const service = createReminderService({ repository: repository({ claimNext: async () => claims++ === 0 ? { recoveredUnknown: true } : null }), loadAuthoritativeContext: async () => ({ season, deadline }), getAccess: async () => ({ effective: true }), providers: { EMAIL: provider }, configuration, now: () => new Date("2026-09-10T12:00:00Z") });
  assert.equal((await service.processDue()).unknown, 1);
  assert.equal(provider.attempts.length, 0);
});

test("provider attempt refreshes authoritative time and suppresses at the deadline", async () => {
  let claims = 0; let clockReads = 0; const provider = createFakeReminderProvider(); const finished = [];
  const service = createReminderService({ repository: repository({ claimNext: async () => claims++ === 0 ? { id: 1, claimVersion: 1, userId: 7, channel: "EMAIL", attemptCount: 0, campaign: { leagueSeasonId: 4, schedulePhase: "REGULAR", round: 3 } } : null, finishClaim: async (value) => { finished.push(value); return true; } }), loadAuthoritativeContext: async () => ({ season, deadline }), getAccess: async () => ({ effective: true }), providers: { EMAIL: provider }, configuration, now: () => clockReads++ === 0 ? new Date("2026-09-10T23:59:59Z") : deadline });
  assert.equal((await service.processDue()).suppressed, 1);
  assert.equal(provider.attempts.length, 0);
  assert.equal(finished[0].state, "SUPPRESSED");
});

test("automatic evaluation stays dormant before the window, at the deadline, and while unavailable", async () => {
  const base = { repository: repository(), loadAuthoritativeContext: async () => ({ season, deadline }), getAccess: async () => ({ effective: true }), configuration };
  assert.equal((await createReminderService({ ...base, now: () => new Date("2026-09-09T23:59:59Z") }).evaluateAutomatic()).status, "NOT_DUE");
  assert.equal((await createReminderService({ ...base, now: () => deadline }).evaluateAutomatic()).status, "CLOSED");
  assert.equal((await createReminderService({ ...base, configuration: { ...configuration, pickRemindersSystemAvailable: false }, now: () => new Date("2026-09-10T12:00:00Z") }).evaluateAutomatic()).status, "UNAVAILABLE");
});

test("manual context is aggregate-only and warns near the automatic window", async () => {
  const service = createReminderService({ repository: repository({ getAutomaticConsumedAt: async () => null }), loadAuthoritativeContext: async () => ({ season, deadline }), getAccess: async () => ({ effective: true }), configuration, now: () => new Date("2026-09-09T23:00:00Z") });
  const context = await service.buildManualCampaignContext();
  assert.deepEqual(context.counts, { email: 1, push: 1 });
  assert.deepEqual(context.warnings, ["AUTOMATIC_REMINDER_DUE_WITHIN_TWO_HOURS"]);
});

test("accepted, temporary, permanent, and exhausted attempts produce bounded aggregate states", async () => {
  async function run(outcome, attemptCount = 0) {
    let claims = 0; const finished = [];
    const service = createReminderService({ repository: repository({ claimNext: async () => claims++ === 0 ? { id: 1, claimVersion: 1, userId: 7, channel: "EMAIL", attemptCount, campaign: { leagueSeasonId: 4, schedulePhase: "REGULAR", round: 3 } } : null, finishClaim: async (value) => { finished.push(value); return true; } }), loadAuthoritativeContext: async () => ({ season, deadline }), getAccess: async () => ({ effective: true }), providers: { EMAIL: createFakeReminderProvider([outcome]) }, configuration, now: () => new Date("2026-09-10T12:00:00Z") });
    return { counts: await service.processDue(), finished };
  }
  assert.equal((await run("ACCEPTED")).counts.accepted, 1);
  assert.equal((await run("TEMPORARY_FAILURE")).counts.temporarilyFailed, 1);
  assert.equal((await run("PERMANENT_FAILURE")).counts.permanentlyFailed, 1);
  assert.equal((await run("TEMPORARY_FAILURE", 3)).counts.retryExhausted, 1);
});

test("delivery logging suppresses idle passes but retains aggregate activity", async () => {
  const events = [];
  let claims = 0;
  const service = createReminderService({
    repository: repository({ claimNext: async () => claims++ === 1 ? { recoveredUnknown: true } : null }),
    loadAuthoritativeContext: async () => ({ season, deadline }),
    getAccess: async () => ({ effective: true }),
    configuration,
    logger: { info: (event, context) => events.push({ event, context }), warn() {} },
    now: () => new Date("2026-09-10T12:00:00Z"),
  });

  assert.deepEqual(await service.processDue(), { claimed: 0, accepted: 0, unknown: 0, temporarilyFailed: 0, permanentlyFailed: 0, suppressed: 0, retryExhausted: 0 });
  assert.deepEqual(events, []);
  assert.equal((await service.processDue()).unknown, 1);
  assert.deepEqual(events, [{ event: "reminder_delivery_completed", context: { claimed: 0, accepted: 0, unknown: 1, temporarilyFailed: 0, permanentlyFailed: 0, suppressed: 0, retryExhausted: 0 } }]);
});

test("cleanup reports bounded history and expired-preference counts", async (t) => {
  t.mock.method(LeagueSeason, "findAll", async () => [{ id: 9 }, { id: 8 }]);
  const service = createReminderService({ repository: repository({ deleteHistoryBeforeSeasonIds: async ({ retainedSeasonIds, limit }) => { assert.deepEqual(retainedSeasonIds, [9, 8]); assert.equal(limit, 25); return 3; }, deleteExpiredPreferences: async () => 2 }), loadAuthoritativeContext: async () => null, configuration, now: () => new Date("2026-09-10T12:00:00Z") });
  assert.deepEqual(await service.cleanup({ limit: 25 }), { historyDeleted: 3, preferencesDeleted: 2, limit: 25 });
});

test("operational status retains only aggregate active/previous-season counts", async (t) => {
  t.mock.method(LeagueSeason, "findAll", async () => [{ id: 9 }, { id: 8 }]);
  const service = createReminderService({ repository: repository({ getOperationalCounts: async ({ retainedSeasonIds }) => { assert.deepEqual(retainedSeasonIds, [9, 8]); return { accepted: 2 }; } }), loadAuthoritativeContext: async () => null, configuration });
  assert.deepEqual(await service.getOperationalStatus(), { counts: { accepted: 2 } });
});
