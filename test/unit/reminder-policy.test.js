const assert = require("node:assert/strict");
const test = require("node:test");

const {
  automaticWindowState,
  evaluateReminderEligibility,
  manualCampaignWarnings,
} = require("../../server/modules/reminders/reminder-policy");

const deadline = new Date("2026-09-11T00:00:00.000Z");
const eligible = (overrides = {}) => evaluateReminderEligibility({
  now: new Date("2026-09-10T12:00:00.000Z"),
  deadline,
  effectiveAccess: true,
  channelEnabled: true,
  channelAvailable: true,
  seasonState: "ACTIVE",
  round: 2,
  schedulePhase: "REGULAR",
  activeTrackCount: 1,
  missingPickCount: 1,
  ...overrides,
});

test("automatic window opens 24 hours before the deadline, catches up, and closes exactly at it", () => {
  assert.equal(automaticWindowState({ now: new Date("2026-09-09T23:59:59.999Z"), deadline }), "NOT_DUE");
  assert.equal(automaticWindowState({ now: new Date("2026-09-10T00:00:00.000Z"), deadline }), "DUE");
  assert.equal(automaticWindowState({ now: new Date("2026-09-10T23:59:59.999Z"), deadline }), "DUE");
  assert.equal(automaticWindowState({ now: deadline, deadline }), "CLOSED");
  assert.equal(automaticWindowState({ now: new Date("2026-09-11T00:00:00.001Z"), deadline }), "CLOSED");
});

test("pre-delivery schedule moves use the refreshed earlier or later deadline", () => {
  const now = new Date("2026-09-10T01:00:00Z");
  assert.equal(automaticWindowState({ now, deadline: new Date("2026-09-11T02:00:00Z") }), "NOT_DUE");
  assert.equal(automaticWindowState({ now, deadline: new Date("2026-09-10T23:00:00Z") }), "DUE");
});

test("eligibility supports every active phase and requires access, consent, availability, an open round, and a missing Pick", () => {
  for (const schedulePhase of ["PRESEASON", "REGULAR", "PLAYOFF"]) assert.deepEqual(eligible({ schedulePhase }), { eligible: true, reason: null });
  for (const overrides of [
    { effectiveAccess: false }, { channelEnabled: false }, { channelAvailable: false },
    { seasonState: "SETUP" }, { seasonState: "COMPLETE" }, { round: 0 },
    { activeTrackCount: 0, missingPickCount: 0 }, { activeTrackCount: 2, missingPickCount: 0 },
    { now: deadline },
  ]) assert.equal(eligible(overrides).eligible, false);
});

test("one missing Pick remains eligible regardless of other submitted Tracks or a pending Buyback Decision", () => {
  assert.equal(eligible({ activeTrackCount: 5, missingPickCount: 1, buybackDecision: "PENDING" }).eligible, true);
});

test("manual campaign warnings are non-blocking around the automatic reminder", () => {
  const now = new Date("2026-09-10T21:00:00.000Z");
  assert.deepEqual(manualCampaignWarnings({ now, automaticDueAt: new Date("2026-09-10T22:30:00.000Z") }), ["AUTOMATIC_REMINDER_DUE_WITHIN_TWO_HOURS"]);
  assert.deepEqual(manualCampaignWarnings({ now, automaticConsumedAt: new Date("2026-09-10T19:30:00.000Z") }), ["AUTOMATIC_REMINDER_SENT_WITHIN_TWO_HOURS"]);
  assert.deepEqual(manualCampaignWarnings({ now, automaticDueAt: new Date("2026-09-11T00:00:01.000Z"), automaticConsumedAt: new Date("2026-09-10T18:59:59.000Z") }), []);
});
