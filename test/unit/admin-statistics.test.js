const assert = require("node:assert/strict");
const { test } = require("node:test");

test("admin statistics use current-season Tracks and current elimination state", async () => {
  const { computeAdminStatistics } = await import("../../public/js/modules/admin-statistics.js");
  const users = [
    {
      first_name: "Alice", last_name: "Able",
      tracks: [
        { league_season_id: 7, current_pick: "Broncos", wrong_pick: null, eliminated_by_pick_id: null },
        { league_season_id: 7, current_pick: "Broncos", wrong_pick: "Raiders", eliminated_by_pick_id: 12 },
        { league_season_id: 6, current_pick: "Chiefs", wrong_pick: null, eliminated_by_pick_id: null },
      ],
    },
    {
      first_name: "Bob", last_name: "Baker",
      Tracks: [{ league_season_id: 7, current_pick: "Raiders", wrong_pick: "Raiders", eliminated_by_pick_id: null }],
    },
    {
      first_name: "Cara", last_name: "Clark",
      tracks: [{ league_season_id: 7, current_pick: "Chiefs", wrong_pick: null, eliminated_by_pick_id: null }],
    },
    { first_name: "No", last_name: "Tracks", tracks: [] },
  ];

  assert.deepEqual(computeAdminStatistics(users, 7), {
    mostPopular: "Broncos (50.00% of current Picks)",
    leastPopular: "Chiefs, Raiders (25.00% of current Picks)",
    usersEliminated: 1,
    usersLeft: 2,
    tracksLeft: 2,
    usersWithMostTracks: "Alice Able, Cara Clark (1 Track)",
    usersWithLeastTracks: "Bob Baker (0 Tracks)",
  });
});

test("admin statistics render ties and empty current-season data safely", async () => {
  const { computeAdminStatistics } = await import("../../public/js/modules/admin-statistics.js");

  assert.deepEqual(computeAdminStatistics([], 7), {
    mostPopular: "Unavailable — no current Picks",
    leastPopular: "Unavailable — no current Picks",
    usersEliminated: 0,
    usersLeft: 0,
    tracksLeft: 0,
    usersWithMostTracks: "Unavailable — no Users with Tracks",
    usersWithLeastTracks: "Unavailable — no Users with Tracks",
  });
  assert.deepEqual(
    computeAdminStatistics([{ first_name: "Legacy", tracks: [{ league_season_id: null, current_pick: "Raiders" }] }], null),
    computeAdminStatistics([], 7)
  );
});

test("riskiest Pick uses the largest favorite spread and includes every matching User", async () => {
  const { computeRiskiestPick } = await import("../../public/js/modules/admin-statistics.js");
  const users = [
    { first_name: "Alice", last_name: "Able", tracks: [{ league_season_id: 7, current_pick: "Broncos" }] },
    { first_name: "Bob", last_name: "Baker", tracks: [{ league_season_id: 7, current_pick: "Broncos" }] },
    { first_name: "Cara", last_name: "Clark", tracks: [{ league_season_id: 7, current_pick: "Raiders" }] },
  ];
  const odds = [
    { bookmakers: [{ markets: [{ outcomes: [{ name: "Broncos", point: -7.5 }, { name: "Chargers", point: 7.5 }] }] }] },
    { bookmakers: [{ markets: [{ outcomes: [{ name: "Raiders", point: 3 }, { name: "Chiefs", point: -3 }] }] }] },
  ];

  assert.deepEqual(computeRiskiestPick(users, 7, odds), {
    team: "Broncos",
    spread: -7.5,
    users: ["Alice Able", "Bob Baker"],
  });
  assert.equal(computeRiskiestPick(users, 7, []), null);
});
