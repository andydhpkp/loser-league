const test = require("node:test");
const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  test("Pick reminder foundation", { skip: "TEST_DATABASE_URL is not set" }, () => {});
} else {
  process.env.NODE_ENV = "test";
  const assert = require("node:assert/strict");
  const { sequelize, User, LeagueSeason, ReminderPreference, ReminderCampaign, ReminderDelivery, AdminAuditOperation, PushSubscription } = require("../../models");
  const repository = require("../../server/modules/reminders/reminder-repository");
  const { createPreview, confirmPreview } = require("../../server/admin/action-service");
  const { migrateEmptyTestDatabase } = require("../support/migrate-test-database");
  const { createSubscriptionCryptography } = require("../../server/modules/reminders/push-subscription-cryptography");
  const { createPushSubscriptionService } = require("../../server/modules/reminders/push-subscription-service");

  test.beforeEach(async () => { await migrateEmptyTestDatabase(sequelize); });
  test.after(async () => sequelize.close());

  async function activeSeason(year = 2026) {
    return LeagueSeason.create({ year, state: "ACTIVE", current_week: 3, schedule_phase: "REGULAR", state_version: 1, open_slot: 1 });
  }

  async function user(username) {
    return User.create({ first_name: "Reminder", last_name: "Test", username, email: `${username}@example.test`, password: "safe-test-password" });
  }

  test("concurrent automatic evaluators create one campaign and one delivery per User/channel", async () => {
    const season = await activeSeason();
    const target = await user("automatic");
    const input = { season, deadline: new Date("2026-09-11T00:00:00Z"), now: new Date("2026-09-10T12:00:00Z"), kind: "AUTOMATIC", candidates: [{ userId: target.id, channel: "EMAIL" }, { userId: target.id, channel: "PUSH" }] };
    const results = await Promise.allSettled([repository.createCampaignWithDeliveries(input), repository.createCampaignWithDeliveries(input)]);
    assert.equal(results.filter(({ status }) => status === "fulfilled").length >= 1, true);
    assert.equal(await ReminderCampaign.count(), 1);
    assert.equal(await ReminderDelivery.count(), 2);
  });

  test("manual campaign confirmation atomically creates aggregate audit and outbox once", async () => {
    const season = await activeSeason();
    const target = await user("manual");
    const context = async () => ({ season, deadline: new Date("2026-09-11T00:00:00Z"), currentTime: new Date("2026-09-10T12:00:00Z"), evaluated: 1, deliveries: [{ userId: target.id, channel: "EMAIL" }], counts: { email: 1, push: 0 }, warnings: [] });
    const preview = await createPreview("SEND_PICK_REMINDERS", {}, { loadManualReminderContext: context });
    assert.deepEqual(preview.eligibleDeliveries, { email: 1, push: 0 });
    assert.equal(Object.hasOwn(preview, "targets"), false);
    const operation = await confirmPreview("SEND_PICK_REMINDERS", preview.confirmationKey, null, { loadManualReminderContext: context });
    assert.equal(operation.action, "SEND_PICK_REMINDERS");
    assert.equal(await ReminderCampaign.count(), 1);
    assert.equal(await ReminderDelivery.count(), 1);
    assert.equal(await AdminAuditOperation.count({ where: { action: "SEND_PICK_REMINDERS" } }), 1);
    assert.equal((await confirmPreview("SEND_PICK_REMINDERS", preview.confirmationKey, null, { loadManualReminderContext: context })).id, operation.id);
    assert.equal(await ReminderDelivery.count(), 1);
  });

  test("concurrent manual confirmations converge on one campaign, outbox, and audit", async () => {
    const season = await activeSeason(); const target = await user("manual-race");
    const context = async () => ({ season, deadline: new Date("2026-09-11T00:00:00Z"), currentTime: new Date("2026-09-10T12:00:00Z"), evaluated: 1, deliveries: [{ userId: target.id, channel: "EMAIL" }], counts: { email: 1, push: 0 }, warnings: [] });
    const [first, second] = await Promise.all([createPreview("SEND_PICK_REMINDERS", {}, { loadManualReminderContext: context }), createPreview("SEND_PICK_REMINDERS", {}, { loadManualReminderContext: context })]);
    const results = await Promise.allSettled([confirmPreview("SEND_PICK_REMINDERS", first.confirmationKey, null, { loadManualReminderContext: context }), confirmPreview("SEND_PICK_REMINDERS", second.confirmationKey, null, { loadManualReminderContext: context })]);
    assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
    assert.equal(await ReminderCampaign.count(), 1); assert.equal(await ReminderDelivery.count(), 1); assert.equal(await AdminAuditOperation.count({ where: { action: "SEND_PICK_REMINDERS" } }), 1);
  });

  test("manual confirmation rejects changed eligibility without campaign, outbox, or audit", async () => {
    const season = await activeSeason(); const target = await user("manual-stale"); let calls = 0;
    const context = async () => {
      calls += 1; const deliveries = calls <= 2 ? [{ userId: target.id, channel: "EMAIL" }] : [];
      return { season, deadline: new Date("2026-09-11T00:00:00Z"), currentTime: new Date("2026-09-10T12:00:00Z"), evaluated: 1, deliveries, counts: { email: deliveries.length, push: 0 }, warnings: [] };
    };
    const preview = await createPreview("SEND_PICK_REMINDERS", {}, { loadManualReminderContext: context });
    await assert.rejects(confirmPreview("SEND_PICK_REMINDERS", preview.confirmationKey, null, { loadManualReminderContext: context }), /stale/);
    assert.equal(await ReminderCampaign.count(), 0); assert.equal(await ReminderDelivery.count(), 0); assert.equal(await AdminAuditOperation.count(), 0);
  });

  test("manual confirmation rejects a refreshed authoritative schedule", async () => {
    const season = await activeSeason(); const target = await user("manual-schedule-stale"); let calls = 0;
    const context = async () => {
      calls += 1;
      const changed = calls > 2;
      return { season, deadline: new Date(changed ? "2026-09-10T23:00:00Z" : "2026-09-11T00:00:00Z"), scheduleHash: changed ? "new-schedule" : "old-schedule", currentTime: new Date("2026-09-10T12:00:00Z"), evaluated: 1, deliveries: [{ userId: target.id, channel: "EMAIL" }], counts: { email: 1, push: 0 }, warnings: [] };
    };
    const preview = await createPreview("SEND_PICK_REMINDERS", {}, { loadManualReminderContext: context });
    await assert.rejects(confirmPreview("SEND_PICK_REMINDERS", preview.confirmationKey, null, { loadManualReminderContext: context }), /stale/);
    assert.equal(await ReminderCampaign.count(), 0); assert.equal(await ReminderDelivery.count(), 0); assert.equal(await AdminAuditOperation.count(), 0);
  });

  test("manual multi-write failure rolls back campaign, delivery, and audit", async () => {
    const season = await activeSeason();
    const context = async () => ({ season, deadline: new Date("2026-09-11T00:00:00Z"), currentTime: new Date("2026-09-10T12:00:00Z"), evaluated: 1, deliveries: [{ userId: 999999, channel: "EMAIL" }], counts: { email: 1, push: 0 }, warnings: [] });
    const preview = await createPreview("SEND_PICK_REMINDERS", {}, { loadManualReminderContext: context });
    await assert.rejects(confirmPreview("SEND_PICK_REMINDERS", preview.confirmationKey, null, { loadManualReminderContext: context }));
    assert.equal(await ReminderCampaign.count(), 0); assert.equal(await ReminderDelivery.count(), 0); assert.equal(await AdminAuditOperation.count(), 0);
  });

  test("User deletion removes preferences and delivery identity while retaining no destination data", async () => {
    const season = await activeSeason();
    const target = await user("deleted");
    await ReminderPreference.create({ user_id: target.id, email_enabled: true, push_enabled: false });
    await repository.createCampaignWithDeliveries({ season, deadline: new Date("2026-09-11T00:00:00Z"), now: new Date("2026-09-10T12:00:00Z"), kind: "AUTOMATIC", candidates: [{ userId: target.id, channel: "EMAIL" }] });
    await target.destroy();
    assert.equal(await ReminderPreference.count(), 0);
    assert.equal(await ReminderDelivery.count(), 0);
    const columns = await sequelize.getQueryInterface().describeTable("reminder_delivery");
    for (const forbidden of ["destination", "message_body", "pick", "team", "email", "endpoint", "payload", "token"]) assert.equal(columns[forbidden], undefined);
  });

  test("multi-device push registration persists only encrypted subscriptions and device-scoped disablement", async () => {
    const target = await user("push-devices"); const key = Buffer.alloc(32, 9).toString("base64");
    const cryptography = createSubscriptionCryptography({ current: { version: "test-v1", key }, digestKey: key });
    const service = createPushSubscriptionService({ cryptography });
    const makeSubscription = (suffix) => ({ endpoint: `https://push.example.test/${suffix}`, expirationTime: null, keys: { p256dh: "A".repeat(87), auth: "B".repeat(22) } });
    await service.register({ userId: target.id, subscription: makeSubscription("one") });
    assert.equal((await service.register({ userId: target.id, subscription: makeSubscription("two") })).deviceCount, 2);
    const rows = await PushSubscription.findAll({ where: { user_id: target.id } });
    assert.equal(rows.length, 2); assert.equal(rows.some((row) => row.ciphertext.includes("push.example")), false);
    assert.equal((await service.disableCurrent({ userId: target.id, endpoint: makeSubscription("one").endpoint })).deviceCount, 1);
    assert.equal((await ReminderPreference.findByPk(target.id)).push_enabled, true);
    assert.equal((await service.disableAll({ userId: target.id })).state, "USER_DISABLED");
    assert.equal((await ReminderPreference.findByPk(target.id)).push_enabled, false);
    await service.register({ userId: target.id, subscription: makeSubscription("three") }); await target.destroy();
    assert.equal(await PushSubscription.count(), 0);
  });

  test("bounded cleanup retains active and previous League Seasons", async () => {
    const old = await LeagueSeason.create({ year: 2024, state: "ROLLED_OVER", current_week: 22, schedule_phase: "REGULAR", state_version: 1, open_slot: null });
    const previous = await LeagueSeason.create({ year: 2025, state: "ROLLED_OVER", current_week: 22, schedule_phase: "REGULAR", state_version: 1, open_slot: null });
    const current = await activeSeason(2026);
    for (const season of [old, previous, current]) await ReminderCampaign.create({ league_season_id: season.id, schedule_phase: "REGULAR", round: 3, kind: "AUTOMATIC", window_key: "FIXED_24_HOUR_V1", authoritative_deadline: new Date("2026-09-11T00:00:00Z") });
    assert.equal(await repository.deleteHistoryBeforeSeasonIds({ retainedSeasonIds: [current.id, previous.id], limit: 100 }), 1);
    assert.deepEqual((await ReminderCampaign.findAll({ order: [["league_season_id", "ASC"]] })).map(({ league_season_id: id }) => id), [previous.id, current.id]);
  });
}
