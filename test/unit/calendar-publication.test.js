const test = require("node:test");
const assert = require("node:assert/strict");

const { reconcileEvents, visibleEvents } = require("../../server/modules/calendar/calendar-publication");

test("publication reconciliation is idempotent and increments only meaningful changes", () => {
  const now = new Date("2026-08-13T00:00:00Z");
  const existing = [{ year: 2026, phase: "REGULAR", round: 1, deadline: new Date("2026-09-10T00:00:00Z"), sequence: 0, status: "CONFIRMED", sourceHash: "same" }];
  const unchanged = reconcileEvents({ existing, evidence: [{ year: 2026, phase: "REGULAR", round: 1, deadline: new Date("2026-09-10T00:00:00Z"), sourceHash: "same" }], invalidKeys: [], now });
  assert.equal(unchanged.changes.length, 0);
  const changed = reconcileEvents({ existing, evidence: [{ year: 2026, phase: "REGULAR", round: 1, deadline: new Date("2026-09-10T01:00:00Z"), sourceHash: "new" }], invalidKeys: [], now });
  assert.equal(changed.changes[0].sequence, 1);
  assert.equal(changed.changes[0].kind, "UPDATE");
  const evidenceOnly = reconcileEvents({ existing, evidence: [{ year: 2026, phase: "REGULAR", round: 1, deadline: new Date("2026-09-10T00:00:00Z"), sourceHash: "other" }], invalidKeys: [], now });
  assert.equal(evidenceOnly.changes[0].kind, "EVIDENCE"); assert.equal(evidenceOnly.changes[0].sequence, 0);
});

test("invalid published future rounds cancel and history expires at 30 days", () => {
  const now = new Date("2026-10-10T00:00:00Z");
  const existing = [{ year: 2026, phase: "REGULAR", round: 2, deadline: new Date("2026-10-11T00:00:00Z"), sequence: 1, status: "CONFIRMED", sourceHash: "old" }];
  const result = reconcileEvents({ existing, evidence: [], invalidKeys: ["2026:REGULAR:2"], now });
  assert.equal(result.changes[0].status, "CANCELLED");
  assert.equal(result.changes[0].sequence, 2);
  assert.equal(visibleEvents([
    { deadline: new Date("2026-09-10T00:00:00Z"), status: "CONFIRMED" },
    { deadline: new Date("2026-09-09T23:59:59Z"), status: "CONFIRMED" },
  ], now).length, 1);
});
