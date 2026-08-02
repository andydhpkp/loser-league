const assert = require("node:assert/strict");
const test = require("node:test");

const { buildOnboardingConfiguration } = require("../../server/onboarding/configuration");
const { isTrackEnrollmentOpen } = require("../../server/modules/league-season/enrollment-policy");

test("onboarding configuration normalizes US contacts and a matching Venmo profile", () => {
  const result = buildOnboardingConfiguration({
    ONBOARDING_TATE_PHONE: "(303) 555-0101",
    ONBOARDING_ANDREW_PHONE: "+1 720 555 0102",
    ONBOARDING_VENMO_HANDLE: "@TateBenson28",
    ONBOARDING_VENMO_URL: "https://account.venmo.com/u/TateBenson28",
  });

  assert.deepEqual(result.invalidSettings, []);
  assert.deepEqual(result.presentation, {
    price: "$5",
    contacts: [
      { name: "Tate", formattedPhone: "(303) 555-0101", smsUrl: "sms:+13035550101" },
      { name: "Andrew", formattedPhone: "(720) 555-0102", smsUrl: "sms:+17205550102" },
    ],
    payment: { handle: "@TateBenson28", url: "https://account.venmo.com/u/TateBenson28" },
  });
});

test("onboarding configuration omits invalid options without exposing their values", () => {
  const result = buildOnboardingConfiguration({
    ONBOARDING_TATE_PHONE: "not-a-number",
    ONBOARDING_ANDREW_PHONE: "3035550102",
    ONBOARDING_VENMO_HANDLE: "@TateBenson28",
    ONBOARDING_VENMO_URL: "https://example.com/u/TateBenson28",
  });

  assert.deepEqual(result.invalidSettings, ["ONBOARDING_TATE_PHONE", "ONBOARDING_VENMO_HANDLE", "ONBOARDING_VENMO_URL"]);
  assert.deepEqual(result.presentation.contacts, [
    { name: "Andrew", formattedPhone: "(303) 555-0102", smsUrl: "sms:+13035550102" },
  ]);
  assert.equal(result.presentation.payment, null);
  assert.equal(JSON.stringify(result).includes("not-a-number"), false);
  assert.equal(JSON.stringify(result).includes("example.com"), false);
});

test("Track enrollment follows Week 0 and the known Week 1 kickoff boundary", () => {
  const now = new Date("2026-09-10T00:00:00Z");
  assert.equal(isTrackEnrollmentOpen({ season: { state: "SETUP", current_week: 0 }, now }), true);
  assert.equal(isTrackEnrollmentOpen({ season: { state: "ACTIVE", current_week: 1 }, now }), true);
  assert.equal(isTrackEnrollmentOpen({ season: { state: "ACTIVE", current_week: 1 }, earliestKickoff: new Date(now.getTime() + 1), now }), true);
  assert.equal(isTrackEnrollmentOpen({ season: { state: "ACTIVE", current_week: 1 }, earliestKickoff: now, now }), false);
  assert.equal(isTrackEnrollmentOpen({ season: { state: "ACTIVE", current_week: 2 }, now }), false);
  assert.equal(isTrackEnrollmentOpen({ season: { state: "COMPLETE", current_week: 1 }, now }), false);
});
