const assert = require("node:assert/strict");
const test = require("node:test");

test("buyback browser view formats fixed price and pending status", async () => {
  const { buildBuybackView } = await import("../../public/js/modules/week-two-buyback.js");
  const view = buildBuybackView({ status: "PENDING_USER_REQUEST", stateVersion: 1, unitPriceCents: 1000, totalCents: 2000, tracks: [], contacts: [], payment: null, pickBlocked: true });
  assert.equal(view.heading, "Week 2 buyback request pending");
  assert.equal(view.unitPrice, "$10.00");
  assert.equal(view.total, "$20.00");
});

test("buyback browser view distinguishes unavailable state", async () => {
  const { buildBuybackView } = await import("../../public/js/modules/week-two-buyback.js");
  assert.equal(buildBuybackView({ status: "UNAVAILABLE", unitPriceCents: 1000, totalCents: 0 }).heading, "Week 2 buyback temporarily unavailable");
  assert.equal(buildBuybackView(null), null);
});
