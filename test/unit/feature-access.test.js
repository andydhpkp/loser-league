const assert = require("node:assert/strict");
const { test } = require("node:test");
const { buildFeatureConfiguration } = require("../../server/features/configuration");
const { FeatureRelease, UserFeatureEntitlement, UserFeatureAccessState } = require("../../models");
const { getPickRemindersAccess } = require("../../server/features/feature-access-service");

test("Pick Reminders availability fails closed when absent or invalid", () => {
  assert.deepEqual(buildFeatureConfiguration({}), { pickRemindersSystemAvailable: false, invalidSettings: [] });
  assert.deepEqual(buildFeatureConfiguration({ PICK_REMINDERS_SYSTEM_AVAILABLE: "TRUE" }), { pickRemindersSystemAvailable: false, invalidSettings: ["PICK_REMINDERS_SYSTEM_AVAILABLE"] });
  assert.deepEqual(buildFeatureConfiguration({ PICK_REMINDERS_SYSTEM_AVAILABLE: "true" }), { pickRemindersSystemAvailable: true, invalidSettings: [] });
});

test("effective access requires system availability and beta or public release", async (t) => {
  t.mock.method(FeatureRelease, "findByPk", async () => ({ public_released: false, state_version: 2 }));
  t.mock.method(UserFeatureEntitlement, "findOne", async () => ({ enabled: true, state_version: 3 }));
  t.mock.method(UserFeatureAccessState, "findOne", async () => null);
  assert.equal((await getPickRemindersAccess({ userId: 7, systemAvailable: false })).effective, false);
  assert.equal((await getPickRemindersAccess({ userId: 7, systemAvailable: true })).effective, true);
});
