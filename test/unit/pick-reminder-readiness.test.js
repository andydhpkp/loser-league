const assert = require("node:assert/strict");
const test = require("node:test");
const { calculatePickReminderReadiness } = require("../../server/features/pick-reminder-readiness");

const readyInput = {
  featureConfiguration: { pickRemindersSystemAvailable: true, pickRemindersPushDeliveryAvailable: true, pickRemindersEmailDeliveryAvailable: true, pickRemindersCalendarAvailable: true },
  pushConfiguration: { ready: true, publicAppOrigin: "https://example.invalid" },
  emailConfiguration: { ready: true },
  calendarConfiguration: { ready: true, publicAppOrigin: "https://example.invalid" },
  providerChannels: ["PUSH", "EMAIL"],
};

test("public readiness requires every method and adapter together", () => {
  assert.equal(calculatePickReminderReadiness(readyInput).ready, true);
  const unavailable = calculatePickReminderReadiness({ ...readyInput, providerChannels: ["PUSH"] });
  assert.equal(unavailable.ready, false);
  assert.equal(unavailable.checks.emailAdapter, false);
  assert.equal(JSON.stringify(unavailable).includes("private"), false);
});
