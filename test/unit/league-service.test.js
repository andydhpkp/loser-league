const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  User,
  Track,
  Pick,
  LeagueSeason,
  LeagueWeekOperation,
  ScheduleSnapshot,
} = require("../../models");
const buybackService = require("../../server/modules/buyback/buyback-service");
const {
  getSubmissionState,
  getLeagueView,
} = require("../../server/modules/picks/league-service");

test("submission state derives the current deadline and eligible Teams for each Track", async (t) => {
  const season = {
    id: 23,
    year: 2026,
    current_week: 2,
    state: "ACTIVE",
  };
  const track = {
    id: 17,
    user_id: 7,
    league_season_id: 23,
    eliminated_by_pick_id: null,
    state_version: 4,
  };
  const snapshot = {
    normalized_schedule: {
      games: [{
        homeTeam: "Denver Broncos",
        awayTeam: "Las Vegas Raiders",
        kickoff: "2026-09-20T18:00:00.000Z",
      }],
    },
  };

  t.mock.method(LeagueSeason, "findOne", async () => season);
  t.mock.method(Track, "findAll", async () => [track]);
  t.mock.method(Pick, "findAll", async () => [{
    track_id: 17,
    week: 1,
    team_name: "Denver Broncos",
  }]);
  t.mock.method(ScheduleSnapshot, "findOne", async () => snapshot);
  t.mock.method(LeagueWeekOperation, "findOne", async () => null);
  t.mock.method(buybackService, "getUserBuyback", async () => null);

  const state = await getSubmissionState({
    userId: 7,
    now: new Date("2026-09-20T17:00:00.000Z"),
  });

  assert.deepEqual(state, {
    leagueSeason: {
      id: 23,
      year: 2026,
      week: 2,
      state: "ACTIVE",
    },
    scheduleAvailable: true,
    deadline: "2026-09-20T18:00:00.000Z",
    submissionOpen: true,
    autoPickStatus: "NOT_DUE",
    tracks: [{
      id: 17,
      stateVersion: 4,
      status: "NOT_SUBMITTED",
      committedTeamName: null,
      usedTeamNames: ["Denver Broncos"],
      eligibleTeams: ["Las Vegas Raiders"],
    }],
  });
});

test("League view hides current Picks until the viewing User completes every active Track", async (t) => {
  const season = {
    id: 23,
    year: 2026,
    current_week: 2,
  };
  const users = [
    {
      id: 7,
      first_name: "Alex",
      last_name: "Viewer",
      getCrownType: () => null,
    },
    {
      id: 8,
      first_name: "Taylor",
      last_name: "Opponent",
      getCrownType: () => "solo-1",
    },
  ];
  const tracks = [
    { id: 17, user_id: 7, eliminated_by_pick_id: null },
    { id: 18, user_id: 7, eliminated_by_pick_id: null },
    { id: 19, user_id: 8, eliminated_by_pick_id: null },
    { id: 20, user_id: 8, eliminated_by_pick_id: 31 },
  ];

  t.mock.method(LeagueSeason, "findOne", async () => season);
  t.mock.method(User, "findAll", async () => users);
  t.mock.method(Track, "findAll", async () => tracks);
  t.mock.method(Pick, "findAll", async () => [
    { track_id: 17, team_name: "Denver Broncos" },
    { track_id: 19, team_name: "Las Vegas Raiders" },
  ]);

  const view = await getLeagueView({ userId: 7 });

  assert.equal(view.pickVisibility, "HIDDEN");
  assert.equal(view.pickStatistics, null);
  assert.deepEqual(view.users, [
    {
      id: 7,
      firstName: "Alex",
      lastName: "Viewer",
      crownType: null,
      tracksRemaining: 2,
      picksSubmitted: false,
      tracks: [
        { id: 17, currentPick: { status: "HIDDEN" } },
        { id: 18, currentPick: { status: "HIDDEN" } },
      ],
    },
    {
      id: 8,
      firstName: "Taylor",
      lastName: "Opponent",
      crownType: "solo-1",
      tracksRemaining: 1,
      picksSubmitted: true,
      tracks: [
        { id: 19, currentPick: { status: "HIDDEN" } },
      ],
    },
  ]);
});
