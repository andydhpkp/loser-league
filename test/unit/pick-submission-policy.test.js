const assert = require("node:assert/strict");
const test = require("node:test");

const {
  eligibleTeamsForTrack,
  currentPickVisibility,
} = require("../../server/modules/picks/submission-policy");
const { normalizeFixtureSchedule } = require("../../server/nfl/fixture-download-client");

test("eligible Teams are scheduled this week and unused by the Track", () => {
  assert.deepEqual(
    eligibleTeamsForTrack({
      scheduledTeams: ["Broncos", "Raiders", "Chiefs"],
      priorTeamNames: ["Raiders"],
    }),
    ["Broncos", "Chiefs"]
  );
});

test("Fixture Download normalization supplies weekly Teams and earliest kickoff", () => {
  const result = normalizeFixtureSchedule([
    { RoundNumber: 1, DateUtc: "2026-09-11 00:00:00Z", HomeTeam: "Raiders", AwayTeam: "Broncos" },
    { RoundNumber: 1, DateUtc: "2026-09-10 20:00:00Z", HomeTeam: "Chiefs", AwayTeam: "Chargers" },
    { RoundNumber: 2, DateUtc: "2026-09-17 20:00:00Z", HomeTeam: "Jets", AwayTeam: "Bills" },
  ], 1);
  assert.deepEqual(result.teams, ["Broncos", "Chargers", "Chiefs", "Raiders"]);
  assert.equal(result.earliestKickoff.toISOString(), "2026-09-10T20:00:00.000Z");
  assert.match(result.contentHash, /^[a-f0-9]{64}$/);
});

test("current Pick visibility is hidden until every active Track has a Pick", () => {
  assert.equal(
    currentPickVisibility({ activeTrackIds: [1, 2], pickedTrackIds: [1] }),
    "HIDDEN"
  );
  assert.equal(
    currentPickVisibility({ activeTrackIds: [1, 2], pickedTrackIds: [1, 2] }),
    "VISIBLE"
  );
  assert.equal(
    currentPickVisibility({ activeTrackIds: [], pickedTrackIds: [] }),
    "VISIBLE"
  );
});
