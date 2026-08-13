const assert = require("node:assert/strict");
const { test } = require("node:test");
const { buildFeatureConfiguration } = require("../../server/features/configuration");
const { FeatureRelease, UserFeatureEntitlement, UserFeatureAccessState } = require("../../models");
const { getPickRemindersAccess } = require("../../server/features/feature-access-service");

test("Pick Reminders availability fails closed when absent or invalid", () => {
  const off = { pickRemindersSystemAvailable: false, pickRemindersEmailDeliveryAvailable: false, pickRemindersPushDeliveryAvailable: false, pickRemindersAdminCampaignAvailable: false };
  assert.deepEqual(buildFeatureConfiguration({}), { ...off, invalidSettings: [] });
  assert.deepEqual(buildFeatureConfiguration({ PICK_REMINDERS_SYSTEM_AVAILABLE: "TRUE" }), { ...off, invalidSettings: ["PICK_REMINDERS_SYSTEM_AVAILABLE"] });
  assert.deepEqual(buildFeatureConfiguration({ PICK_REMINDERS_SYSTEM_AVAILABLE: "true", PICK_REMINDERS_EMAIL_DELIVERY_AVAILABLE: "true", PICK_REMINDERS_PUSH_DELIVERY_AVAILABLE: "false", PICK_REMINDERS_ADMIN_CAMPAIGN_AVAILABLE: "true" }), {
    pickRemindersSystemAvailable: true, pickRemindersEmailDeliveryAvailable: true, pickRemindersPushDeliveryAvailable: false, pickRemindersAdminCampaignAvailable: true, invalidSettings: [],
  });
});

test("effective access requires system availability and beta or public release", async (t) => {
  t.mock.method(FeatureRelease, "findByPk", async () => ({ public_released: false, state_version: 2 }));
  t.mock.method(UserFeatureEntitlement, "findOne", async () => ({ enabled: true, state_version: 3 }));
  t.mock.method(UserFeatureAccessState, "findOne", async () => null);
  assert.equal((await getPickRemindersAccess({ userId: 7, systemAvailable: false })).effective, false);
  assert.equal((await getPickRemindersAccess({ userId: 7, systemAvailable: true })).effective, true);
});
