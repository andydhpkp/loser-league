const assert = require("node:assert/strict");
const { test } = require("node:test");

test("Pick review labels use per-User Track ordinals instead of database IDs", async () => {
  const { formatPickReviewLabel } = await import("../../public/js/modules/track-actions.js");

  assert.equal(formatPickReviewLabel({ trackId: 1364, teamName: "Seattle Seahawks" }, 0), "Track 1: Seattle Seahawks");
  assert.equal(formatPickReviewLabel({ trackId: 1365, teamName: "San Francisco 49ers" }, 1), "Track 2: San Francisco 49ers");
  assert.equal(formatPickReviewLabel({ trackId: 1366, teamName: "Carolina Panthers" }, 2), "Track 3: Carolina Panthers");
});
