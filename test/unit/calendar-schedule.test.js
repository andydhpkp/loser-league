const test = require("node:test");
const assert = require("node:assert/strict");

const { validateSeasonRounds } = require("../../server/modules/calendar/calendar-schedule");

test("season validation keeps trustworthy rounds and isolates an invalid future round", () => {
  const result = validateSeasonRounds({ year: 2026, phase: "REGULAR", rounds: [
    { round: 1, games: [{ kickoff: "2026-09-10T23:30:00Z", homeTeam: "Broncos", awayTeam: "Raiders" }] },
    { round: 2, games: [{ kickoff: "bad", homeTeam: "Chiefs", awayTeam: "Chargers" }] },
    { round: 3, games: [{ kickoff: "2026-09-24T23:30:00Z", homeTeam: "Broncos", awayTeam: "Raiders" }] },
  ] });
  assert.deepEqual(result.valid.map((round) => round.round), [1, 3]);
  assert.deepEqual(result.invalidRounds, [2]);
  assert.equal(result.valid[0].deadline.toISOString(), "2026-09-10T23:30:00.000Z");
});

test("season validation omits setup and rejects contradictory or ambiguous schedules", () => {
  const result = validateSeasonRounds({ year: 2026, phase: "PRESEASON", rounds: [
    { round: 0, games: [{ kickoff: "2026-08-01T00:00:00Z", homeTeam: "A", awayTeam: "B" }] },
    { round: 1, games: [
      { kickoff: "2026-08-08T00:00:00Z", homeTeam: "A", awayTeam: "B" },
      { kickoff: "2026-08-09T00:00:00Z", homeTeam: "A", awayTeam: "B" },
    ] },
  ] });
  assert.deepEqual(result.valid, []);
  assert.deepEqual(result.invalidRounds, [1]);
});

test("season validation rejects wrong-season evidence without corrupting another round", () => {
  const result = validateSeasonRounds({ year: 2026, phase: "REGULAR", rounds: [
    { round: 1, games: [{ kickoff: "2025-09-10T00:00:00Z", homeTeam: "A", awayTeam: "B" }] },
    { round: 2, games: [{ kickoff: "2026-09-17T00:00:00Z", homeTeam: "C", awayTeam: "D" }] },
  ] });
  assert.deepEqual(result.invalidRounds, [1]); assert.deepEqual(result.valid.map(({ round }) => round), [2]);
});
