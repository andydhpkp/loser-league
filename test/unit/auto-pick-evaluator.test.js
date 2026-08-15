const assert = require("node:assert/strict");
const test = require("node:test");

const { LeagueSeason } = require("../../models");
const { normalizeEspnFixtureSchedule } = require("../../server/nfl/fixture-download-client");
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

test("preseason evaluator becomes due at the first kickoff while retaining only unstarted Teams", async () => {
  const currentTime = new Date("2026-08-02T00:00:00.000Z");
  let executedSchedule;
  const evaluator = createAutoPickEvaluator({
    findSeason: async () => ({ id: 1, year: 2026, current_week: 2, state: "ACTIVE", schedule_phase: "PRESEASON" }),
    fetchSchedule: async ({ now }) => ({
      ...normalizeEspnFixtureSchedule({ events: [
        { date: "2026-08-01T00:00:00Z", status: { type: { completed: false } }, competitions: [{ competitors: [{ homeAway: "home", team: { displayName: "Broncos" } }, { homeAway: "away", team: { displayName: "Raiders" } }] }] },
        { date: "2026-08-03T00:00:00Z", status: { type: { completed: false } }, competitions: [{ competitors: [{ homeAway: "home", team: { displayName: "Chiefs" } }, { homeAway: "away", team: { displayName: "Chargers" } }] }] },
      ] }, 2, now),
      year: 2026,
      week: 2,
      seasonPhase: "PRESEASON",
      fetchedAt: now,
    }),
    persistSchedule: async () => {},
    execute: async ({ schedule }) => {
      executedSchedule = schedule;
      return { status: currentTime >= schedule.earliestKickoff ? "COMPLETED" : "NOT_DUE" };
    },
    now: () => currentTime,
  });

  const result = await evaluator();

  assert.equal(result.status, "COMPLETED");
  assert.equal(result.deadline.toISOString(), "2026-08-01T00:00:00.000Z");
  assert.deepEqual(executedSchedule.teams, ["Chargers", "Chiefs"]);
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
