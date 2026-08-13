const assert = require("node:assert/strict");
const test = require("node:test");
const { createReminderPreferenceService } = require("../../server/modules/reminders/reminder-preference-service");

test("missing durable preferences read as independently disabled channels", async () => {
  const service = createReminderPreferenceService({ findPreference: async () => null });
  assert.deepEqual(await service.get(7), { emailEnabled: false, pushEnabled: false, stateVersion: 0 });
});

test("the narrow preference write accepts channels only and increments durable state", async () => {
  const writes = [];
  const service = createReminderPreferenceService({ findPreference: async () => ({ email_enabled: false, push_enabled: false, state_version: 2 }), savePreference: async (value) => writes.push(value) });
  assert.deepEqual(await service.setChannel(7, "EMAIL", true), { emailEnabled: true, pushEnabled: false, stateVersion: 3 });
  assert.deepEqual(writes[0], { userId: 7, emailEnabled: true, pushEnabled: false, stateVersion: 3 });
  await assert.rejects(service.setChannel(7, "CALENDAR", true), /channel/i);
});
