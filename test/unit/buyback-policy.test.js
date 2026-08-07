const test = require("node:test");
const assert = require("node:assert/strict");
const {
  BUYBACK_PRICE_CENTS,
  eligibleBuybackTracks,
  eligibleWeekOneTracks,
  normalizeTrackIds,
  partitionResolution,
  buybackView,
} = require("../../server/modules/buyback/buyback-policy");

test("buyback eligibility includes only active-season Week 1 Wrong Pick eliminations", () => {
  const tracks = [
    { id: 1, eliminatedByPickId: 11, eliminatingPick: { id: 11, week: 1, outcome: "WRONG_PICK", teamName: "Bears" } },
    { id: 2, eliminatedByPickId: null, eliminatingPick: null },
    { id: 3, eliminatedByPickId: 13, eliminatingPick: { id: 13, week: 2, outcome: "WRONG_PICK", teamName: "Jets" } },
    { id: 4, eliminatedByPickId: 14, eliminatingPick: { id: 14, week: 1, outcome: "PENDING", teamName: "Giants" } },
  ];
  assert.deepEqual(eligibleWeekOneTracks(tracks), [{ trackId: 1, pickId: 11, teamName: "Bears" }]);
});

test("preseason buyback eligibility accepts Wrong Pick eliminations from any week", () => {
  const tracks = [
    { id: 1, eliminatedByPickId: 11, eliminatingPick: { id: 11, week: 1, outcome: "WRONG_PICK", teamName: "Bears" } },
    { id: 2, eliminatedByPickId: 12, eliminatingPick: { id: 12, week: 3, outcome: "WRONG_PICK", teamName: "Jets" } },
    { id: 3, eliminatedByPickId: 13, eliminatingPick: { id: 13, week: 4, outcome: "PENDING", teamName: "Giants" } },
  ];
  assert.deepEqual(eligibleBuybackTracks({ tracks, schedulePhase: "PRESEASON" }), [
    { trackId: 1, pickId: 11, teamName: "Bears", eliminatingWeek: 1 },
    { trackId: 2, pickId: 12, teamName: "Jets", eliminatingWeek: 3 },
  ]);
  assert.deepEqual(eligibleBuybackTracks({ tracks, schedulePhase: "REGULAR" }), [
    { trackId: 1, pickId: 11, teamName: "Bears", eliminatingWeek: 1 },
  ]);
});

test("selection normalization is exact, sorted, and duplicate-safe", () => {
  assert.deepEqual(normalizeTrackIds([3, "1"]), [1, 3]);
  assert.throws(() => normalizeTrackIds([1, 1]), /unique/i);
  assert.throws(() => normalizeTrackIds([]), /at least one/i);
});

test("admin resolution requires a complete partition and fulfillment for completion", () => {
  assert.deepEqual(partitionResolution({ requestedTrackIds: [1, 2, 3], fulfilledTrackIds: [2] }), {
    fulfilledTrackIds: [2], unfulfilledTrackIds: [1, 3], totalCents: BUYBACK_PRICE_CENTS,
  });
  assert.throws(() => partitionResolution({ requestedTrackIds: [1], fulfilledTrackIds: [] }), /at least one fulfilled/i);
  assert.throws(() => partitionResolution({ requestedTrackIds: [1], fulfilledTrackIds: [2] }), /requested/i);
});

test("sanitized buyback views expose explicit gate and fixed totals", () => {
  const view = buybackView({
    decision: { status: "PENDING_USER_REQUEST", stateVersion: 2 },
    tracks: [{ trackId: 7, teamName: "Bears", resolution: "PENDING" }],
    presentation: { contacts: [], payment: null }, deadlineAvailable: true, schedulePhase: "PRESEASON",
  });
  assert.deepEqual(view, {
    status: "PENDING_USER_REQUEST", stateVersion: 2, pickBlocked: true,
    unitPriceCents: 1000, selectedCount: 1, totalCents: 1000,
    tracks: [{ trackId: 7, weekOnePick: "Bears", resolution: "PENDING" }],
    schedulePhase: "PRESEASON",
    contacts: [], payment: null,
  });
});
