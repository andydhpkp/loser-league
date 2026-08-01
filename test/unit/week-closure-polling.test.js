const assert = require("node:assert/strict");
const test = require("node:test");

const { planNextResultCheck } = require("../../server/modules/week-closure/week-closure-polling");

test("result polling sleeps until expected finishes and collapses overlapping game windows", () => {
  const kickoffs = [
    "2026-09-13T17:00:00.000Z",
    "2026-09-13T17:05:00.000Z",
    "2026-09-13T20:25:00.000Z",
  ];

  assert.deepEqual(planNextResultCheck({
    now: new Date("2026-09-13T18:00:00.000Z"),
    kickoffs,
    games: [],
  }), { checkAt: new Date("2026-09-13T19:45:00.000Z"), refreshSchedule: false });

  assert.deepEqual(planNextResultCheck({
    now: new Date("2026-09-13T19:46:00.000Z"),
    kickoffs,
    games: [{ status: "PENDING" }, { status: "PENDING" }, { status: "PENDING" }],
  }), { checkAt: new Date("2026-09-13T19:47:00.000Z"), refreshSchedule: false });

  assert.deepEqual(planNextResultCheck({ now: new Date("2026-09-13T19:46:00.000Z"), kickoffs, games: [{ status: "DELAYED" }, { status: "PENDING" }, { status: "PENDING" }] }), { checkAt: new Date("2026-09-13T19:51:00.000Z"), refreshSchedule: true });
  assert.deepEqual(planNextResultCheck({ now: new Date("2026-09-14T03:00:00.000Z"), kickoffs, games: [{ status: "FINAL" }, { status: "FINAL" }, { status: "FINAL" }] }), { checkAt: null, refreshSchedule: false });
});
