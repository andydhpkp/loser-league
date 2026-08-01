const assert = require("node:assert/strict");
const test = require("node:test");

const { createDefaultWeekClosureEvaluator, createWeekClosureEvaluator } = require("../../server/modules/week-closure/week-closure-evaluator");

test("default closure evaluator assembles production adapters without performing work", () => {
  assert.equal(typeof createDefaultWeekClosureEvaluator({ fetchImpl: async () => { throw new Error("not called"); } }), "function");
});

test("closure evaluator waits for the first expected finish without polling ESPN", async () => {
  let espnFetches = 0;
  const evaluator = createWeekClosureEvaluator({
    findSeason: async () => ({ id: 1, year: 2026, current_week: 1, state: "ACTIVE" }),
    fetchSchedule: async () => ({
      year: 2026,
      week: 1,
      provider: "FIXTURE_DOWNLOAD",
      contentHash: "a".repeat(64),
      normalizedSchedule: { week: 1, games: [{ kickoff: "2026-09-13T17:00:00.000Z", homeTeam: "Broncos", awayTeam: "Raiders" }] },
      fetchedAt: new Date("2026-09-13T16:00:00.000Z"),
    }),
    persistSchedule: async () => {},
    fetchResults: async () => { espnFetches += 1; },
    findOverrides: async () => [],
    execute: async () => { throw new Error("closure must not run"); },
    now: () => new Date("2026-09-13T18:00:00.000Z"),
  });

  const result = await evaluator();

  assert.equal(result.status, "NOT_DUE");
  assert.equal(result.nextCheckAt.toISOString(), "2026-09-13T19:45:00.000Z");
  assert.equal(espnFetches, 0);
});

test("closure evaluator reconciles due terminal games and executes automatic closure", async () => {
  let closureInput;
  const evaluator = createWeekClosureEvaluator({
    findSeason: async () => ({ id: 7, year: 2026, current_week: 1, state: "ACTIVE" }),
    fetchSchedule: async () => ({
      year: 2026,
      week: 1,
      provider: "FIXTURE_DOWNLOAD",
      contentHash: "b".repeat(64),
      normalizedSchedule: { week: 1, games: [{ kickoff: "2026-09-13T17:00:00.000Z", homeTeam: "Broncos", awayTeam: "Raiders" }] },
      fetchedAt: new Date("2026-09-13T16:00:00.000Z"),
    }),
    persistSchedule: async () => {},
    fetchResults: async () => ({ content: { schedule: { "2026-09-13": { games: [{
      status: { type: { completed: true } },
      competitions: [{ competitors: [
        { homeAway: "home", score: "17", team: { displayName: "Broncos" } },
        { homeAway: "away", score: "10", team: { displayName: "Raiders" } },
      ] }],
    }] } } } }),
    findOverrides: async () => [],
    execute: async (input) => { closureInput = input; return { status: "COMPLETED", week: 1 }; },
    now: () => new Date("2026-09-13T19:45:00.000Z"),
  });

  const result = await evaluator();

  assert.equal(result.status, "COMPLETED");
  assert.equal(closureInput.leagueSeasonId, 7);
  assert.equal(closureInput.scheduleHash, "b".repeat(64));
  assert.equal(closureInput.mode, "AUTOMATIC");
  assert.deepEqual(closureInput.games, [{ homeTeam: "Broncos", awayTeam: "Raiders", status: "FINAL", winnerTeam: "Broncos", loserTeam: "Raiders", tied: false }]);
});

test("closure evaluator backs delayed games off and refreshes Fixture on the next check", async () => {
  let scheduleFetches = 0;
  const evaluator = createWeekClosureEvaluator({
    findSeason: async () => ({ id: 7, year: 2026, current_week: 1, state: "ACTIVE" }),
    fetchSchedule: async () => { scheduleFetches += 1; return { year: 2026, week: 1, provider: "FIXTURE_DOWNLOAD", contentHash: "c".repeat(64), normalizedSchedule: { week: 1, games: [{ kickoff: "2026-09-13T17:00:00.000Z", homeTeam: "Broncos", awayTeam: "Raiders" }] }, fetchedAt: new Date() }; },
    persistSchedule: async () => {},
    fetchResults: async () => ({ content: { schedule: { "2026-09-13": { games: [{ status: { type: { completed: false, name: "STATUS_SUSPENDED" } }, competitions: [{ competitors: [{ homeAway: "home", score: "0", team: { displayName: "Broncos" } }, { homeAway: "away", score: "0", team: { displayName: "Raiders" } }] }] }] } } } }),
    findOverrides: async () => [],
    execute: async () => { throw new Error("closure must not run"); },
    now: () => new Date("2026-09-13T20:00:00.000Z"),
  });

  const first = await evaluator();
  const second = await evaluator();
  assert.equal(first.status, "PENDING");
  assert.equal(first.refreshSchedule, true);
  assert.equal(first.nextCheckAt.toISOString(), "2026-09-13T20:05:00.000Z");
  assert.equal(second.status, "PENDING");
  assert.equal(scheduleFetches, 2);
});

test("closure evaluator stays dormant outside active weeks and invalidates schedule cache on week change", async () => {
  const seasons = [
    { id: 7, year: 2026, current_week: 0, state: "SETUP" },
    { id: 7, year: 2026, current_week: 1, state: "ACTIVE" },
    { id: 7, year: 2026, current_week: 2, state: "ACTIVE" },
  ];
  let scheduleFetches = 0;
  const evaluator = createWeekClosureEvaluator({
    findSeason: async () => seasons.shift(),
    fetchSchedule: async ({ week }) => { scheduleFetches += 1; return { year: 2026, week, provider: "FIXTURE_DOWNLOAD", contentHash: "d".repeat(64), normalizedSchedule: { week, games: [{ kickoff: "2026-09-13T17:00:00.000Z", homeTeam: "Broncos", awayTeam: "Raiders" }] }, fetchedAt: new Date() }; },
    persistSchedule: async () => {}, fetchResults: async () => {}, findOverrides: async () => [], execute: async () => {},
    now: () => new Date("2026-09-13T18:00:00.000Z"),
  });

  assert.equal((await evaluator()).nextCheckAt, null);
  await evaluator();
  await evaluator();
  assert.equal(scheduleFetches, 2);
});
