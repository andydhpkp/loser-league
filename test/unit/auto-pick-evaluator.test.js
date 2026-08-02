const assert = require("node:assert/strict");
const test = require("node:test");

const { LeagueSeason } = require("../../models");
const {
  createAutoPickEvaluator,
  createDefaultAutoPickEvaluator,
} = require("../../server/modules/picks/auto-pick-evaluator");

test("evaluator refreshes on the five-minute cadence and every 30 seconds near deadline", async () => {
  let currentTime = new Date("2026-09-09T23:40:00Z");
  let fetches = 0;
  const evaluator = createAutoPickEvaluator({
    findSeason: async () => ({ id: 1, year: 2026, current_week: 1, state: "ACTIVE" }),
    fetchSchedule: async ({ now }) => {
      fetches += 1;
      return { year: 2026, week: 1, earliestKickoff: new Date("2026-09-10T00:00:00Z"), fetchedAt: now };
    },
    persistSchedule: async () => {},
    execute: async () => ({ status: "NOT_DUE" }),
    now: () => currentTime,
  });

  await evaluator();
  currentTime = new Date("2026-09-09T23:44:59Z");
  await evaluator();
  currentTime = new Date("2026-09-09T23:45:00Z");
  await evaluator();
  currentTime = new Date("2026-09-09T23:45:29Z");
  await evaluator();
  currentTime = new Date("2026-09-09T23:45:30Z");
  await evaluator();

  assert.equal(fetches, 3);
});

test("default evaluator stays dormant without an active League Season", async (t) => {
  t.mock.method(LeagueSeason, "findOne", async (query) => {
    assert.deepEqual(query, { where: { open_slot: 1 } });
    return null;
  });

  const evaluator = createDefaultAutoPickEvaluator({
    fetchImpl: async () => {
      throw new Error("dormant evaluator must not fetch");
    },
    now: () => new Date("2026-09-09T23:40:00.000Z"),
  });

  assert.deepEqual(await evaluator(), {
    status: "NOT_DUE",
    deadline: null,
  });
});
