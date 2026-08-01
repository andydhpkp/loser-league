const assert = require("node:assert/strict");
const test = require("node:test");

const {
  autoPickDue,
  planAutomaticSelections,
} = require("../../server/modules/picks/auto-pick-policy");
const { normalizeFixtureSchedule } = require("../../server/nfl/fixture-download-client");

test("validated weekly schedule deduplicates exact games and uses the earliest UTC kickoff", () => {
  const result = normalizeFixtureSchedule([
    { RoundNumber: 1, DateUtc: "2026-09-13 18:00:00Z", HomeTeam: "Raiders", AwayTeam: "Broncos" },
    { RoundNumber: 1, DateUtc: "2026-09-11 00:00:00Z", HomeTeam: "Chiefs", AwayTeam: "Chargers" },
    { RoundNumber: 1, DateUtc: "2026-09-11 00:00:00Z", HomeTeam: "Chiefs", AwayTeam: "Chargers" },
    { RoundNumber: 2, DateUtc: "2026-09-18 00:00:00Z", HomeTeam: "Jets", AwayTeam: "Bills" },
  ], 1);

  assert.equal(result.earliestKickoff.toISOString(), "2026-09-11T00:00:00.000Z");
  assert.equal(result.normalizedSchedule.games.length, 2);
  assert.equal(autoPickDue({ now: new Date("2026-09-10T23:59:59.999Z"), deadline: result.earliestKickoff }), false);
  assert.equal(autoPickDue({ now: new Date("2026-09-11T00:00:00.000Z"), deadline: result.earliestKickoff }), true);
});

test("validated weekly schedule rejects contradictory duplicate matchups and Team reuse", () => {
  assert.throws(() => normalizeFixtureSchedule([
    { RoundNumber: 1, DateUtc: "2026-09-11 00:00:00Z", HomeTeam: "Chiefs", AwayTeam: "Chargers" },
    { RoundNumber: 1, DateUtc: "2026-09-12 00:00:00Z", HomeTeam: "Chiefs", AwayTeam: "Chargers" },
  ], 1), /invalid/);
  assert.throws(() => normalizeFixtureSchedule([
    { RoundNumber: 1, DateUtc: "2026-09-11 00:00:00Z", HomeTeam: "Chiefs", AwayTeam: "Chargers" },
    { RoundNumber: 1, DateUtc: "2026-09-12 00:00:00Z", HomeTeam: "Chiefs", AwayTeam: "Raiders" },
  ], 1), /invalid/);
});

test("each missing Track receives an independent deterministic draw from its own eligible set", () => {
  const indices = [1, 0];
  const selections = planAutomaticSelections({
    tracks: [
      { id: 10, priorTeamNames: ["Broncos"] },
      { id: 20, priorTeamNames: ["Raiders"] },
    ],
    scheduledTeams: ["Broncos", "Chargers", "Chiefs", "Raiders"],
    randomIndex: (length) => {
      const index = indices.shift();
      assert.ok(index < length);
      return index;
    },
  });

  assert.deepEqual(selections, [
    { trackId: 10, teamName: "Chiefs" },
    { trackId: 20, teamName: "Broncos" },
  ]);
});
