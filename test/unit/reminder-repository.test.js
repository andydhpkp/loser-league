const assert = require("node:assert/strict");
const test = require("node:test");
const { sequelize, User, LeagueSeason, ReminderPreference, ReminderCampaign, ReminderDelivery, UserFeatureAccessState, PushSubscription } = require("../../models");
const repository = require("../../server/modules/reminders/reminder-repository");

test("repository loads the open round and derives active missing-Pick candidate counts", async (t) => {
  t.mock.method(LeagueSeason, "findOne", async (query) => { assert.deepEqual(query.where, { open_slot: 1 }); return { id: 4 }; });
  t.mock.method(User, "findAll", async (query) => {
    assert.equal(query.include[0].model, ReminderPreference);
    return [{ id: 7, reminderPreference: { email_enabled: true, push_enabled: false }, tracks: [{ picks: [] }, { picks: [{ id: 2 }] }] }];
  });
  t.mock.method(User, "findByPk", async (id) => id === 7 ? { id: 7, reminderPreference: { email_enabled: true, push_enabled: false }, tracks: [{ picks: [] }, { picks: [{ id: 2 }] }] } : null);
  assert.deepEqual(await repository.loadRoundContext(), { id: 4 });
  assert.deepEqual(await repository.listCandidateViews({ season: { id: 4, current_week: 3 } }), [{ userId: 7, emailEnabled: true, pushEnabled: false, activeTrackCount: 2, missingPickCount: 1 }]);
  assert.equal((await repository.loadCandidateView({ season: { id: 4, current_week: 3 }, userId: 7 })).missingPickCount, 1);
  assert.equal((await repository.loadCandidateView({ season: { id: 4, current_week: 3 }, userId: 99 })).activeTrackCount, 0);
});

test("campaign creation uses stable identity and duplicate-safe delivery inserts", async (t) => {
  const calls = [];
  t.mock.method(ReminderCampaign, "findOrCreate", async (query) => { calls.push(query); return [{ id: 12 }, true]; });
  t.mock.method(ReminderDelivery, "findOrCreate", async (query) => { calls.push(query); return [{ id: 13 }, true]; });
  t.mock.method(ReminderDelivery, "count", async () => 2);
  const result = await repository.createCampaignWithDeliveries({ season: { id: 4, schedule_phase: "REGULAR", current_week: 3 }, deadline: new Date("2026-09-11T00:00:00Z"), kind: "AUTOMATIC", candidates: [{ userId: 7, channel: "EMAIL" }], transaction: {} });
  assert.equal(result.created, true);
  assert.equal(calls[0].where.window_key, "FIXED_24_HOUR_V1");
  assert.deepEqual(calls[1].where, { reminder_campaign_id: 12, user_id: 7, channel: "EMAIL" });
  assert.equal(calls[1].defaults.state, "PENDING");
});

test("claiming leases one due row and finish uses the claim version", async (t) => {
  const updates = [];
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  t.mock.method(sequelize, "transaction", async (_options, work) => work(transaction));
  let lookup = 0;
  t.mock.method(ReminderDelivery, "findOne", async () => lookup++ === 0 ? null : ({ id: 2, user_id: 7, channel: "EMAIL", attempt_count: 0, claim_version: 1, campaign: { id: 9, league_season_id: 4, schedule_phase: "REGULAR", round: 3 }, async update(values) { Object.assign(this, values); updates.push(values); } }));
  const now = new Date("2026-09-10T12:00:00Z");
  const claim = await repository.claimNext({ now });
  assert.equal(claim.claimVersion, 2);
  assert.equal(updates[0].claimed_until.getTime() - now.getTime(), repository.CLAIM_LEASE_MS);
  t.mock.method(ReminderDelivery, "update", async (values, options) => { updates.push({ values, options }); return [1]; });
  assert.equal(await repository.finishClaim({ claim, state: "TEMPORARILY_FAILED", now, retryDelayMs: 60_000 }), true);
  assert.equal(updates[1].options.where.claim_version, 2);
  assert.equal(updates[1].values.next_attempt_at.getTime() - now.getTime(), 60_000);
});

test("an expired claim becomes unknown and is never blindly resent", async (t) => {
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  t.mock.method(sequelize, "transaction", async (_options, work) => work(transaction));
  const expired = { async update(values) { Object.assign(this, values); } };
  t.mock.method(ReminderDelivery, "findOne", async () => expired);
  assert.deepEqual(await repository.claimNext({ now: new Date("2026-09-10T12:00:00Z") }), { recoveredUnknown: true });
  assert.equal(expired.state, "UNKNOWN");
});

test("ineligible due delivery is suppressed before it can be claimed", async (t) => {
  const transaction = { LOCK: { UPDATE: "UPDATE" } }; let lookup = 0;
  t.mock.method(sequelize, "transaction", async (_options, work) => work(transaction));
  const delivery = { async update(values) { Object.assign(this, values); } };
  t.mock.method(ReminderDelivery, "findOne", async () => lookup++ === 0 ? null : delivery);
  assert.deepEqual(await repository.claimNext({ now: new Date(), validate: async () => ({ eligible: false, reason: "PICKS_COMPLETE" }) }), { suppressed: true });
  assert.equal(delivery.state, "SUPPRESSED"); assert.equal(delivery.suppression_reason, "PICKS_COMPLETE");
});

test("cleanup deletes bounded old history and expired grace preferences", async (t) => {
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  t.mock.method(sequelize, "transaction", async (workOrOptions, maybeWork) => (maybeWork || workOrOptions)(transaction));
  t.mock.method(ReminderCampaign, "findAll", async () => [{ id: 1 }, { id: 2 }]);
  t.mock.method(ReminderCampaign, "destroy", async () => 1);
  t.mock.method(ReminderDelivery, "findAll", async () => []);
  t.mock.method(ReminderDelivery, "count", async () => 0);
  assert.equal(await repository.deleteHistoryBeforeSeasonIds({ retainedSeasonIds: [9, 8], limit: 100 }), 2);
  t.mock.method(UserFeatureAccessState, "findAll", async () => [{ user_id: 7 }]);
  t.mock.method(ReminderPreference, "destroy", async () => 1);
  t.mock.method(PushSubscription, "destroy", async () => 1);
  t.mock.method(UserFeatureAccessState, "destroy", async () => 1);
  assert.equal(await repository.deleteExpiredPreferences({ now: new Date(), limit: 100 }), 2);
});

test("automatic proximity lookup returns the latest accepted timestamp", async (t) => {
  const consumedAt = new Date("2026-09-10T12:00:00Z");
  t.mock.method(ReminderCampaign, "findOne", async () => ({ id: 3 }));
  t.mock.method(ReminderDelivery, "findOne", async () => ({ consumed_at: consumedAt }));
  assert.equal(await repository.getAutomaticConsumedAt({ season: { id: 4, schedule_phase: "REGULAR", current_week: 3 } }), consumedAt);
});

test("operational counts aggregate only sanitized campaign and result states", async (t) => {
  t.mock.method(ReminderCampaign, "findAll", async () => [{ evaluated_count: 3, eligible_count: 2 }]);
  t.mock.method(ReminderDelivery, "count", async () => [{ state: "ACCEPTED", count: "1" }, { state: "UNKNOWN", count: "1" }]);
  t.mock.method(ReminderDelivery, "findAll", async () => [{ claimed: "3", retried: "1" }]);
  assert.deepEqual(await repository.getOperationalCounts({ retainedSeasonIds: [4] }), { evaluated: 3, eligible: 2, claimed: 3, accepted: 1, unknown: 1, temporarilyFailed: 0, retried: 1, permanentlyFailed: 0, suppressed: 0, retryExhausted: 0 });
});
