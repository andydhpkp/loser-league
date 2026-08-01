const assert = require("node:assert/strict");
const test = require("node:test");

const { createDefaultManualClosureContextLoader, createManualClosureContextLoader } = require("../../server/modules/week-closure/manual-closure-context");

test("default manual closure loader assembles production adapters without performing work", () => {
  assert.equal(typeof createDefaultManualClosureContextLoader({ fetchImpl: async () => { throw new Error("not called"); } }), "function");
});

test("manual closure context permits final selected games and reports unfinished unselected games", async () => {
  const load = createManualClosureContextLoader({
    findSeason: async () => ({ id: 1, year: 2026, current_week: 1, state: "ACTIVE" }),
    findSchedule: async () => ({ content_hash: "e".repeat(64), normalized_schedule: { week: 1, games: [
      { kickoff: "2026-09-10T00:00:00.000Z", homeTeam: "Broncos", awayTeam: "Raiders" },
      { kickoff: "2026-09-13T20:00:00.000Z", homeTeam: "Chiefs", awayTeam: "Chargers" },
    ] } }),
    fetchResults: async () => ({ content: { schedule: {
      "2026-09-10": { games: [{ status: { type: { completed: true } }, competitions: [{ competitors: [
        { homeAway: "home", score: "17", team: { displayName: "Broncos" } },
        { homeAway: "away", score: "10", team: { displayName: "Raiders" } },
      ] }] }] },
      "2026-09-13": { games: [{ status: { type: { completed: false } }, competitions: [{ competitors: [
        { homeAway: "home", score: "0", team: { displayName: "Chiefs" } },
        { homeAway: "away", score: "0", team: { displayName: "Chargers" } },
      ] }] }] },
    } } }),
    findOverrides: async () => [],
    findAutoPick: async () => ({ id: 9 }),
    findActiveTracks: async () => [{ id: 10 }],
    findPicks: async () => [{ id: 20, track_id: 10, team_name: "Raiders", outcome: "PENDING", schedule_hash: "e".repeat(64) }],
  });

  const context = await load();

  assert.deepEqual(context.selectedTeamNames, ["Raiders"]);
  assert.deepEqual(context.unfinishedUnselectedGames, [{ homeTeam: "Chiefs", awayTeam: "Chargers" }]);
});
