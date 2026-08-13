const { ValidationError } = require("../../lib/errors");

const AUTOMATIC_WINDOW_MS = 24 * 60 * 60 * 1000;
const MANUAL_PROXIMITY_MS = 2 * 60 * 60 * 1000;

function validDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function automaticWindowState({ now, deadline }) {
  if (!validDate(now) || !validDate(deadline)) throw new ValidationError("Reminder time is invalid");
  if (now >= deadline) return "CLOSED";
  return now.getTime() >= deadline.getTime() - AUTOMATIC_WINDOW_MS ? "DUE" : "NOT_DUE";
}

function evaluateReminderEligibility({
  now,
  deadline,
  effectiveAccess,
  channelEnabled,
  channelAvailable,
  seasonState,
  round,
  activeTrackCount,
  missingPickCount,
}) {
  if (!validDate(now) || !validDate(deadline)) return { eligible: false, reason: "INVALID_DEADLINE" };
  if (effectiveAccess !== true) return { eligible: false, reason: "ACCESS_UNAVAILABLE" };
  if (channelEnabled !== true) return { eligible: false, reason: "CHANNEL_DISABLED" };
  if (channelAvailable !== true) return { eligible: false, reason: "CHANNEL_UNAVAILABLE" };
  if (seasonState !== "ACTIVE") return { eligible: false, reason: "SEASON_INACTIVE" };
  if (!Number.isInteger(round) || round < 1) return { eligible: false, reason: "ROUND_INACTIVE" };
  if (now >= deadline) return { eligible: false, reason: "DEADLINE_REACHED" };
  if (!Number.isInteger(activeTrackCount) || activeTrackCount < 1) return { eligible: false, reason: "NO_ACTIVE_TRACKS" };
  if (!Number.isInteger(missingPickCount) || missingPickCount < 1) return { eligible: false, reason: "PICKS_COMPLETE" };
  return { eligible: true, reason: null };
}

function manualCampaignWarnings({ now, automaticDueAt, automaticConsumedAt }) {
  if (!validDate(now)) throw new ValidationError("Reminder time is invalid");
  const warnings = [];
  if (validDate(automaticDueAt) && automaticDueAt >= now && automaticDueAt.getTime() - now.getTime() <= MANUAL_PROXIMITY_MS) {
    warnings.push("AUTOMATIC_REMINDER_DUE_WITHIN_TWO_HOURS");
  }
  if (validDate(automaticConsumedAt) && automaticConsumedAt <= now && now.getTime() - automaticConsumedAt.getTime() <= MANUAL_PROXIMITY_MS) {
    warnings.push("AUTOMATIC_REMINDER_SENT_WITHIN_TWO_HOURS");
  }
  return warnings;
}

module.exports = { AUTOMATIC_WINDOW_MS, MANUAL_PROXIMITY_MS, automaticWindowState, evaluateReminderEligibility, manualCampaignWarnings };
