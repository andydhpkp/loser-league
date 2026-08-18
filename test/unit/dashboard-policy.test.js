const assert = require("node:assert/strict");
const test = require("node:test");

const { dashboardSummary } = require("../../server/modules/dashboard/dashboard-policy");

function state(overrides = {}) {
  return {
    leagueSeason: { year: 2026, week: 4, state: "ACTIVE" },
    scheduleAvailable: true,
    deadline: "2026-09-10T00:00:00.000Z",
    submissionOpen: true,
    tracks: [{ status: "NOT_SUBMITTED" }, { status: "SUBMITTED" }],
    ...overrides,
  };
}

test("dashboard summary exposes minimal authoritative counts and capability", () => {
  assert.deepEqual(dashboardSummary(state()), {
    leagueSeason: { year: 2026, week: 4, state: "ACTIVE" },
    deadline: { available: true, timestamp: "2026-09-10T00:00:00.000Z" },
    tracks: { active: 2, picksSubmitted: false },
    leagueView: { allowed: false, label: "Submit Picks for all active Tracks before viewing the League." },
    makePicks: { code: "PICKS_REQUIRED", label: "Submit this week's Picks" },
    features: { pickReminders: false },
  });
});

test("dashboard exposes only server-computed Pick Reminders access", () => {
  assert.equal(dashboardSummary(state(), { pickReminders: true }).features.pickReminders, true);
  assert.deepEqual(Object.keys(dashboardSummary(state(), { pickReminders: false }).features), ["pickReminders"]);
});

test("dashboard League view capability allows complete, zero-Track, and Week 0 Users", () => {
  assert.equal(dashboardSummary(state({ tracks: [{ status: "SUBMITTED" }] })).leagueView.allowed, true);
  assert.equal(dashboardSummary(state({ tracks: [] })).leagueView.allowed, true);
  assert.equal(dashboardSummary(state({ leagueSeason: { year: 2026, week: 0, state: "SETUP" } })).leagueView.allowed, true);
});

test("dashboard Make Picks status follows lifecycle precedence", () => {
  const cases = [
    [state({ scheduleAvailable: false, deadline: null }), "LIFECYCLE_UNAVAILABLE", "Pick status is temporarily unavailable"],
    [state({ leagueSeason: { year: 2026, week: 0, state: "SETUP" }, tracks: [] }), "SEASON_NOT_STARTED", "Season has not started"],
    [state({ leagueSeason: { year: 2026, week: 18, state: "COMPLETED" } }), "SEASON_COMPLETE", "League Season is complete"],
    [state({ tracks: [] }), "NO_ACTIVE_TRACKS", "No Picks required"],
    [state({ buyback: { pickBlocked: true } }), "BUYBACK_BLOCKED", "Resolve your Week 2 buyback first"],
    [state({ submissionOpen: false }), "SUBMISSION_CLOSED", "Pick submission is closed"],
    [state({ tracks: [{ status: "SUBMITTED" }] }), "ALL_SUBMITTED", "All Picks submitted"],
    [state({ tracks: [{ status: "NOT_SUBMITTED" }, { status: "NOT_SUBMITTED" }] }), "PICKS_REQUIRED", "Submit this week's Picks"],
  ];
  for (const [input, code, label] of cases) {
    assert.deepEqual(dashboardSummary(input).makePicks, { code, label });
  }
});

test("dashboard Pick completion is not required outside an active round", () => {
  assert.equal(dashboardSummary(state({ tracks: [] })).tracks.picksSubmitted, null);
  assert.equal(dashboardSummary(state({ leagueSeason: { year: 2026, week: 0, state: "SETUP" } })).tracks.picksSubmitted, null);
  assert.equal(dashboardSummary(state({ leagueSeason: { year: 2026, week: 18, state: "COMPLETED" } })).tracks.picksSubmitted, null);
});

test("dashboard uses preseason buyback wording", () => {
  const summary = dashboardSummary(state({ leagueSeason: { year: 2026, week: 4, state: "ACTIVE", schedulePhase: "PRESEASON" }, buyback: { pickBlocked: true } }));
  assert.deepEqual(summary.makePicks, { code: "BUYBACK_BLOCKED", label: "Resolve your preseason buyback first" });
  assert.equal(summary.leagueSeason.schedulePhase, "PRESEASON");
});
