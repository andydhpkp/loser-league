const assert = require("node:assert/strict");
const test = require("node:test");

const {
  planLegacyTrackBackfill,
} = require("../../server/modules/league-season/legacy-track-backfill");

test("legacy Track backfill assigns weeks and preserves current and Wrong Pick meaning", () => {
  const plan = planLegacyTrackBackfill({
    currentWeek: 3,
    track: {
      id: 42,
      usedPicks: ["Broncos", "Raiders", "Jets"],
      availablePicks: ["Bears"],
      currentPick: "Jets",
      wrongPick: "Raiders",
    },
  });

  assert.deepEqual(plan, {
    trackId: 42,
    eliminatingPickWeek: 2,
    picks: [
      { week: 1, teamName: "Broncos", outcome: "PREDICTION_CORRECT" },
      { week: 2, teamName: "Raiders", outcome: "WRONG_PICK" },
      { week: 3, teamName: "Jets", outcome: "PENDING" },
    ],
  });
});

test("legacy Track backfill rejects ambiguous or contradictory Pick state", () => {
  const baseTrack = {
    id: 42,
    usedPicks: ["Broncos", "Raiders"],
    availablePicks: ["Bears"],
    currentPick: "Raiders",
    wrongPick: null,
  };

  assert.throws(
    () => planLegacyTrackBackfill({ currentWeek: 1, track: baseTrack }),
    /more Picks than the active week/
  );
  assert.throws(
    () =>
      planLegacyTrackBackfill({
        currentWeek: 2,
        track: { ...baseTrack, availablePicks: ["Broncos"] },
      }),
    /both used and available/
  );
  assert.throws(
    () =>
      planLegacyTrackBackfill({
        currentWeek: 2,
        track: { ...baseTrack, currentPick: "Bears" },
      }),
    /current Pick/
  );
});

test("legacy Track backfill preserves an active Week 1 buyback Wrong Pick", () => {
  const plan = planLegacyTrackBackfill({
    currentWeek: 2,
    weekOneBuyback: true,
    track: {
      id: 42,
      usedPicks: ["Broncos", "Raiders"],
      availablePicks: ["Bears"],
      currentPick: "Raiders",
      wrongPick: null,
    },
  });

  assert.equal(plan.eliminatingPickWeek, null);
  assert.deepEqual(plan.picks, [
    { week: 1, teamName: "Broncos", outcome: "WRONG_PICK" },
    { week: 2, teamName: "Raiders", outcome: "PENDING" },
  ]);
});
