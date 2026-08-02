const assert = require("node:assert/strict");
const test = require("node:test");

const {
  planAssignCurrentPick,
  planBuybackReactivation,
  planPlayoffPoolReset,
  planReplaceCurrentPick,
  planResetCurrentPick,
} = require("../../server/modules/admin-repairs/repair-policy");

const season = { id: 4, state: "ACTIVE", currentWeek: 3, pickCycle: 1 };
const track = { id: 9, eliminatedByPickId: null, currentPick: "Broncos", usedPicks: ["Raiders", "Chiefs", "Broncos"], availablePicks: ["Chargers"] };
const pick = { id: 33, week: 3, teamName: "Broncos", outcome: "PENDING", pickCycle: 1 };

test("current-week reset removes one pending Pick and restores its Team to the current pool", () => {
  assert.deepEqual(planResetCurrentPick({ season, track, pick }), {
    deletePickId: 33,
    trackAfter: { currentPick: null, usedPicks: ["Raiders", "Chiefs"], availablePicks: ["Chargers", "Broncos"] },
  });
  assert.throws(() => planResetCurrentPick({ season, track, pick: { ...pick, outcome: "WRONG_PICK" } }), /pending/i);
});

test("admin assignment fills a missing Pick and replacement swaps one pending Pick", () => {
  const missingTrack = { ...track, currentPick: null, usedPicks: ["Raiders", "Chiefs"], availablePicks: ["Broncos", "Chargers"] };
  assert.deepEqual(planAssignCurrentPick({ season, track: missingTrack, teamName: "Broncos", scheduledTeams: ["Broncos", "Raiders"] }), {
    pickAfter: { week: 3, teamName: "Broncos", outcome: "PENDING", origin: "SHARED_ADMIN_REPAIR", pickCycle: 1 },
    trackAfter: { currentPick: "Broncos", usedPicks: ["Raiders", "Chiefs", "Broncos"], availablePicks: ["Chargers"] },
  });
  assert.deepEqual(planReplaceCurrentPick({ season, track, pick, teamName: "Chargers", scheduledTeams: ["Chargers", "Chiefs"] }), {
    pickAfter: { teamName: "Chargers", origin: "SHARED_ADMIN_REPAIR", pickCycle: 1 },
    trackAfter: { currentPick: "Chargers", usedPicks: ["Raiders", "Chiefs", "Chargers"], availablePicks: ["Broncos"] },
  });
  assert.throws(() => planAssignCurrentPick({ season, track: missingTrack, teamName: "Raiders", scheduledTeams: ["Raiders"] }), /available/i);
});

test("buyback clears active elimination while preserving the factual Wrong Pick", () => {
  const eliminatedTrack = { ...track, currentPick: null, wrongPick: "Broncos", eliminatedByPickId: 33 };
  const wrongPick = { ...pick, week: 1, outcome: "WRONG_PICK" };
  assert.deepEqual(planBuybackReactivation({ track: eliminatedTrack, eliminatingPick: wrongPick }), {
    waivedPickId: 33,
    trackAfter: { eliminatedByPickId: null, wrongPick: null },
  });
  assert.throws(() => planBuybackReactivation({ track: { ...eliminatedTrack, eliminatedByPickId: null }, eliminatingPick: wrongPick }), /eliminated/i);
});

test("manual Week 19 reset moves every Track to an empty playoff eligibility pool without changing elimination", () => {
  const tracks = [
    { ...track, currentPick: null },
    { ...track, id: 10, currentPick: null, eliminatedByPickId: 44 },
  ];
  assert.deepEqual(planPlayoffPoolReset({
    season: { ...season, currentWeek: 19 },
    tracks,
    teamNames: ["Broncos", "Raiders", "Chiefs"],
    hasWeekPick: false,
    hasAutoPick: false,
  }), {
    seasonAfter: { pickCycle: 2 },
    trackChanges: [
      { trackId: 9, usedPicks: [], availablePicks: ["Broncos", "Raiders", "Chiefs"] },
      { trackId: 10, usedPicks: [], availablePicks: ["Broncos", "Raiders", "Chiefs"] },
    ],
  });
  assert.throws(() => planPlayoffPoolReset({ season, tracks, teamNames: ["Broncos"], hasWeekPick: false, hasAutoPick: false }), /Week 19/);
  assert.throws(() => planPlayoffPoolReset({ season: { ...season, currentWeek: 19 }, tracks, teamNames: ["Broncos"], hasWeekPick: true, hasAutoPick: false }), /before/i);
});
