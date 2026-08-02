const assert = require("node:assert/strict");
const test = require("node:test");
const { createHistoricalResultsLoader } = require("../../server/modules/admin-repairs/historical-results-context");

test("historical repair context reconciles a stored Fixture schedule with final ESPN evidence", async () => {
  const load = createHistoricalResultsLoader({
    findSchedule: async () => ({ content_hash: "a".repeat(64), normalized_schedule: { games: [{ homeTeam: "Broncos", awayTeam: "Raiders" }] } }),
    fetchResults: async () => ({ content: { schedule: { day: { games: [{ status: { type: { completed: true } }, competitions: [{ competitors: [
      { homeAway: "home", team: { displayName: "Broncos" }, score: "10" },
      { homeAway: "away", team: { displayName: "Raiders" }, score: "7" },
    ] }] }] } } } }),
    findOverrides: async () => [],
  });
  const result = await load({ leagueSeasonId: 2, year: 2026, week: 1 });
  assert.equal(result.scheduleHash, "a".repeat(64));
  assert.deepEqual(result.games[0], { homeTeam: "Broncos", awayTeam: "Raiders", status: "FINAL", winnerTeam: "Broncos", loserTeam: "Raiders", tied: false });
});

test("historical repair context rejects incomplete weeks", async () => {
  const load = createHistoricalResultsLoader({
    findSchedule: async () => ({ content_hash: "b".repeat(64), normalized_schedule: { games: [{ homeTeam: "Broncos", awayTeam: "Raiders" }] } }),
    fetchResults: async () => ({ content: { schedule: {} } }),
    findOverrides: async () => [],
  });
  await assert.rejects(load({ leagueSeasonId: 2, year: 2026, week: 1 }), /Every historical game/);
});
