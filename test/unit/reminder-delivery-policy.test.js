const assert = require("node:assert/strict");
const test = require("node:test");

const { nextDeliveryState, providerIntent } = require("../../server/modules/reminders/reminder-delivery-policy");

test("provider intent is minimal and contains no personalized or deadline data", () => {
  assert.deepEqual(providerIntent("EMAIL"), { kind: "PICK_REMINDER", channel: "EMAIL", navigateTo: "DASHBOARD" });
  assert.deepEqual(providerIntent("PUSH"), { kind: "PICK_REMINDER", channel: "PUSH", navigateTo: "DASHBOARD" });
});

test("accepted, permanent, and ambiguous outcomes are terminal", () => {
  assert.deepEqual(nextDeliveryState({ outcome: "ACCEPTED", attemptCount: 1 }), { state: "ACCEPTED", retryDelayMs: null });
  assert.deepEqual(nextDeliveryState({ outcome: "PERMANENT_FAILURE", attemptCount: 1 }), { state: "PERMANENTLY_FAILED", retryDelayMs: null });
  assert.deepEqual(nextDeliveryState({ outcome: "UNKNOWN", attemptCount: 1 }), { state: "UNKNOWN", retryDelayMs: null });
});

test("definite temporary failures use bounded fixed backoff and exhaust after four attempts", () => {
  assert.deepEqual(nextDeliveryState({ outcome: "TEMPORARY_FAILURE", attemptCount: 1 }), { state: "TEMPORARILY_FAILED", retryDelayMs: 60_000 });
  assert.deepEqual(nextDeliveryState({ outcome: "TEMPORARY_FAILURE", attemptCount: 2 }), { state: "TEMPORARILY_FAILED", retryDelayMs: 300_000 });
  assert.deepEqual(nextDeliveryState({ outcome: "TEMPORARY_FAILURE", attemptCount: 3 }), { state: "TEMPORARILY_FAILED", retryDelayMs: 900_000 });
  assert.deepEqual(nextDeliveryState({ outcome: "TEMPORARY_FAILURE", attemptCount: 4 }), { state: "RETRY_EXHAUSTED", retryDelayMs: null });
});

test("provider outcomes and channels fail closed", () => {
  assert.throws(() => providerIntent("CALENDAR"), /channel/i);
  assert.throws(() => nextDeliveryState({ outcome: "DELIVERED", attemptCount: 1 }), /outcome/i);
});
