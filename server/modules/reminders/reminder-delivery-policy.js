const { ValidationError } = require("../../lib/errors");

const RETRY_DELAYS_MS = Object.freeze([60_000, 300_000, 900_000]);
const PROVIDER_OUTCOMES = new Set(["ACCEPTED", "TEMPORARY_FAILURE", "PERMANENT_FAILURE", "UNKNOWN"]);

function providerIntent(channel) {
  if (channel !== "EMAIL" && channel !== "PUSH") throw new ValidationError("Reminder channel is invalid");
  return { kind: "PICK_REMINDER", channel, navigateTo: "DASHBOARD" };
}

function nextDeliveryState({ outcome, attemptCount }) {
  if (!PROVIDER_OUTCOMES.has(outcome)) throw new ValidationError("Provider outcome is invalid");
  if (!Number.isInteger(attemptCount) || attemptCount < 1) throw new ValidationError("Attempt count is invalid");
  if (outcome === "ACCEPTED") return { state: "ACCEPTED", retryDelayMs: null };
  if (outcome === "UNKNOWN") return { state: "UNKNOWN", retryDelayMs: null };
  if (outcome === "PERMANENT_FAILURE") return { state: "PERMANENTLY_FAILED", retryDelayMs: null };
  const retryDelayMs = RETRY_DELAYS_MS[attemptCount - 1];
  return retryDelayMs === undefined
    ? { state: "RETRY_EXHAUSTED", retryDelayMs: null }
    : { state: "TEMPORARILY_FAILED", retryDelayMs };
}

module.exports = { PROVIDER_OUTCOMES, RETRY_DELAYS_MS, nextDeliveryState, providerIntent };
