const assert = require("node:assert/strict");
const test = require("node:test");
const { buildRolloverExport, deriveWinningUsers, normalizeTargetYear, normalizeWinnerTrackIds } = require("../../server/modules/league-season/completion-rollover-policy");

test("winner normalization is unique and winning Users determine tie status", () => {
  assert.deepEqual(normalizeWinnerTrackIds([3, "1", 3]), [1, 3]);
  assert.deepEqual(deriveWinningUsers([{ user_id: 8 }, { user_id: 8 }]), { userIds: [8], wonWithTie: false });
  assert.deepEqual(deriveWinningUsers([{ user_id: 8 }, { user_id: 4 }]), { userIds: [4, 8], wonWithTie: true });
});

test("target year is explicitly supplied and export is deterministic and sanitized", () => {
  assert.equal(normalizeTargetYear("2027"), 2027);
  assert.throws(() => normalizeTargetYear(2027), /four-digit/);
  const input = { season: { id: 2, year: 2026, current_week: 22 }, tracks: [{ id: 3, user_id: 4, eliminated_by_pick_id: null }], picks: [] };
  assert.deepEqual(buildRolloverExport(input), buildRolloverExport(input));
  assert.equal(JSON.stringify(buildRolloverExport(input)).includes("email"), false);
  assert.equal(buildRolloverExport(input).filename, "loser-league-2026.json");
});
