const assert = require("node:assert/strict");
const { test } = require("node:test");

test("standings calculations rank surviving Tracks and compute weekly summaries", async () => {
  const { computeWeekStats, sortUsersByTracksLeft } = await import(
    "../../public/js/modules/league-stats.js"
  );
  const users = [
    {
      first_name: "Zoe",
      last_name: "Zero",
      tracks: [{ wrong_pick: "Raiders", current_pick: "Raiders" }],
    },
    {
      first_name: "Amy",
      last_name: "Able",
      tracks: [
        { wrong_pick: null, current_pick: "Broncos" },
        { wrong_pick: null, current_pick: "Chiefs" },
      ],
    },
    {
      first_name: "Ben",
      last_name: "Baker",
      tracks: [{ wrong_pick: null, current_pick: "Broncos" }],
    },
  ];

  const sorted = sortUsersByTracksLeft([...users]);
  assert.deepEqual(
    sorted.map((user) => user.first_name),
    ["Amy", "Ben", "Zoe"]
  );

  assert.deepEqual(computeWeekStats(users), {
    mostPopular: "Broncos (2)",
    leastPopular: "Chiefs (1)",
    onTheBlock: "Ben Baker",
    stillPerfect: "Amy Able, Ben Baker",
    mostTracks: "Amy Able (2)",
  });
});

test("weekly summaries handle ties, missing Picks, and empty input", async () => {
  const { computeWeekStats } = await import(
    "../../public/js/modules/league-stats.js"
  );
  const tied = computeWeekStats([
    {
      first_name: "A",
      last_name: "One",
      tracks: [{ wrong_pick: null, current_pick: "A" }],
    },
    {
      first_name: "B",
      last_name: "Two",
      tracks: [{ wrong_pick: null, current_pick: "B" }],
    },
    { first_name: "C", last_name: "None", tracks: [] },
  ]);

  assert.equal(tied.mostPopular, "A, B (1)");
  assert.equal(tied.leastPopular, "A, B (1)");
  assert.equal(tied.onTheBlock, "A One, B Two");
  assert.equal(tied.stillPerfect, "A One, B Two");
  assert.equal(tied.mostTracks, "A One, B Two (1)");

  assert.deepEqual(computeWeekStats([]), {
    mostPopular: "—",
    leastPopular: "—",
    onTheBlock: "None",
    stillPerfect: "None",
    mostTracks: "—",
  });
});

test("crown presentation maps supported model types to winner artwork", async () => {
  const { getCrownInfo } = await import("../../public/js/utilityFunctions.js");

  assert.equal(getCrownInfo(), null);
  assert.equal(getCrownInfo(null), null);
  assert.equal(getCrownInfo("solo_2"), null);
  assert.equal(getCrownInfo("solo_1_tied_1"), null);
  assert.deepEqual(getCrownInfo("solo_1"), {
    src: "/css/assets/crowns/first_time_solo_winner_crown.png",
    alt: "Crown for a first-time solo winner",
  });
  assert.deepEqual(getCrownInfo("tied_1"), {
    src: "/css/assets/crowns/first_time_tie_crown_2_people.png",
    alt: "Crown for a first-time winner in a two-person tie",
  });
});

test("browser NFL data requests use only same-origin application routes", async () => {
  const { fetchNflSchedule, fetchNflTeams } = await import(
    "../../public/js/modules/nfl-data.js"
  );
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(url);
    return { ok: true };
  };

  await fetchNflTeams(fetchImpl);
  await fetchNflSchedule(2025, 7, fetchImpl);

  assert.deepEqual(urls, [
    "/api/nfl/teams",
    "/api/nfl/schedule?year=2025&week=7",
  ]);
});
