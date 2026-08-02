const assert = require("node:assert/strict");
const { test } = require("node:test");

const pickLeagueService = require("../../server/modules/picks/league-service");
const { getSummary } = require("../../server/modules/dashboard/dashboard-service");

test("dashboard summary derives its actions from the User submission state", async (t) => {
  t.mock.method(pickLeagueService, "getSubmissionState", async ({ userId }) => {
    assert.equal(userId, 7);
    return {
      leagueSeason: { id: 23, year: 2026, week: 2, state: "ACTIVE" },
      scheduleAvailable: true,
      deadline: "2026-09-20T18:00:00.000Z",
      submissionOpen: true,
      autoPickStatus: "NOT_DUE",
      tracks: [{
        id: 17,
        status: "NOT_SUBMITTED",
      }],
    };
  });

  const summary = await getSummary({ userId: 7 });

  assert.deepEqual(summary.makePicks, {
    code: "PICKS_REQUIRED",
    label: "1 Pick still needed",
  });
  assert.equal(summary.leagueSeason.week, 2);
  assert.equal(summary.tracks.active, 1);
  assert.equal(summary.tracks.missingPicks, 1);
});
