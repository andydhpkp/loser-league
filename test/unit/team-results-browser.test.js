const assert = require("node:assert/strict");
const test = require("node:test");

test("League result rendering uses the server year/week and only colors terminal Picks", async () => {
  const { finalScores } = await import("../../public/js/modules/team-results.js");
  const classes = new Set();
  const cell = {
    children: [{ innerText: "Raiders" }],
    classList: { add: (value) => classes.add(value), remove: (value) => classes.delete(value) },
  };
  const calls = [];
  await finalScores({
    year: 2026,
    week: 1,
    root: { getElementsByClassName: () => [cell] },
    fetchScheduleImpl: async (year, week) => {
      calls.push({ year, week });
      return { ok: true, json: async () => ({ content: { schedule: { "2026-09-10": { games: [{
        status: { type: { completed: true } },
        competitions: [{ competitors: [
          { homeAway: "home", score: "17", team: { displayName: "Broncos" } },
          { homeAway: "away", score: "10", team: { displayName: "Raiders" } },
        ] }],
      }] } } } }) };
    },
  });

  assert.deepEqual(calls, [{ year: 2026, week: 1 }]);
  assert.deepEqual([...classes], ["winner"]);
});
