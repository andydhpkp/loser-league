const assert = require("node:assert/strict");
const test = require("node:test");

test("zero-Track presentation distinguishes open, closed, and total fallback states", async () => {
  const { buildOnboardingView } = await import("../../public/js/modules/zero-track-onboarding.js");
  const base = {
    price: "$5",
    contacts: [{ name: "Tate", formattedPhone: "(303) 555-0101", smsUrl: "sms:+13035550101" }],
    payment: { handle: "@TateBenson28", url: "https://account.venmo.com/u/TateBenson28" },
  };

  const open = buildOnboardingView({ ...base, enrollmentOpen: true });
  assert.equal(open.heading, "Ready to play?");
  assert.match(open.explanation, /Tracks are \$5 each/);
  assert.match(open.notice, /manual admin step/);
  assert.equal(open.payment.label, "Pay Tate on Venmo (@TateBenson28)");
  assert.equal(open.contacts[0].label, "Text Tate for help");

  const closed = buildOnboardingView({ ...base, enrollmentOpen: false });
  assert.equal(closed.heading, "Track enrollment is closed");
  assert.equal(closed.payment, null);
  assert.match(closed.explanation, /currently closed/);

  const fallback = buildOnboardingView({ enrollmentOpen: true, price: "$5", contacts: [], payment: null });
  assert.equal(fallback.fallback, true);
  assert.match(fallback.explanation, /Contact a league organizer/);
});
