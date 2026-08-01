const assert = require("node:assert/strict");
const test = require("node:test");

const {
  planPickOutcomes,
  reconcileWeeklyResults,
} = require("../../server/modules/week-closure/week-results-policy");

function espnGame({ homeTeam, awayTeam, homeScore, awayScore, completed = true }) {
  return {
    status: { type: { completed } },
    competitions: [{
      competitors: [
        { homeAway: "home", score: String(homeScore), team: { displayName: homeTeam } },
        { homeAway: "away", score: String(awayScore), team: { displayName: awayTeam } },
      ],
    }],
  };
}

test("nonterminal postponed games remain unresolved and request delayed handling", () => {
  const game = espnGame({ homeTeam: "Broncos", awayTeam: "Raiders", homeScore: 0, awayScore: 0, completed: false });
  game.status.type.name = "STATUS_POSTPONED";
  const result = reconcileWeeklyResults({
    fixtureSchedule: { week: 1, games: [{ kickoff: "2026-09-10T00:00:00.000Z", homeTeam: "Broncos", awayTeam: "Raiders" }] },
    espnSchedule: { content: { schedule: { "2026-09-10": { games: [game] } } } },
  });

  assert.equal(result.allFinal, false);
  assert.equal(result.games[0].status, "DELAYED");
});

test("weekly results match terminal ESPN games to Fixture matchups rather than feed position", () => {
  const result = reconcileWeeklyResults({
    fixtureSchedule: {
      week: 1,
      games: [
        { kickoff: "2026-09-10T00:00:00.000Z", homeTeam: "Broncos", awayTeam: "Raiders" },
        { kickoff: "2026-09-13T18:00:00.000Z", homeTeam: "Chiefs", awayTeam: "Chargers" },
      ],
    },
    espnSchedule: {
      content: {
        schedule: {
          "2026-09-13": { games: [espnGame({ homeTeam: "Chiefs", awayTeam: "Chargers", homeScore: 20, awayScore: 24 })] },
          "2026-09-10": { games: [espnGame({ homeTeam: "Broncos", awayTeam: "Raiders", homeScore: 17, awayScore: 10 })] },
        },
      },
    },
  });

  assert.deepEqual(result.games, [
    { homeTeam: "Broncos", awayTeam: "Raiders", status: "FINAL", winnerTeam: "Broncos", loserTeam: "Raiders", tied: false },
    { homeTeam: "Chiefs", awayTeam: "Chargers", status: "FINAL", winnerTeam: "Chargers", loserTeam: "Chiefs", tied: false },
  ]);
  assert.equal(result.allFinal, true);
});

test("weekly results reject duplicate ESPN matchups instead of choosing one result", () => {
  assert.throws(() => reconcileWeeklyResults({
    fixtureSchedule: {
      week: 1,
      games: [{ kickoff: "2026-09-10T00:00:00.000Z", homeTeam: "Broncos", awayTeam: "Raiders" }],
    },
    espnSchedule: {
      content: {
        schedule: {
          "2026-09-10": { games: [
            espnGame({ homeTeam: "Broncos", awayTeam: "Raiders", homeScore: 17, awayScore: 10 }),
            espnGame({ homeTeam: "Raiders", awayTeam: "Broncos", homeScore: 10, awayScore: 17 }),
          ] },
        },
      },
    },
  }), /duplicate/i);
});

test("weekly results reject ESPN matchups outside the complete Fixture schedule", () => {
  assert.throws(() => reconcileWeeklyResults({
    fixtureSchedule: { week: 1, games: [{ kickoff: "2026-09-10T00:00:00.000Z", homeTeam: "Broncos", awayTeam: "Raiders" }] },
    espnSchedule: { content: { schedule: { "2026-09-10": { games: [
      espnGame({ homeTeam: "Broncos", awayTeam: "Raiders", homeScore: 17, awayScore: 10 }),
      espnGame({ homeTeam: "Chiefs", awayTeam: "Chargers", homeScore: 20, awayScore: 24 }),
    ] } } } },
  }), /Fixture schedule/i);
});

test("weekly results reject a Fixture schedule that reuses a Team", () => {
  assert.throws(() => reconcileWeeklyResults({
    fixtureSchedule: { week: 1, games: [
      { kickoff: "2026-09-10T00:00:00.000Z", homeTeam: "Broncos", awayTeam: "Raiders" },
      { kickoff: "2026-09-13T18:00:00.000Z", homeTeam: "Broncos", awayTeam: "Chiefs" },
    ] },
    espnSchedule: { content: { schedule: {} } },
  }), /Fixture schedule/i);
});

test("terminal ESPN games with missing scores fail closed", () => {
  const game = espnGame({ homeTeam: "Broncos", awayTeam: "Raiders", homeScore: 17, awayScore: 10 });
  game.competitions[0].competitors[1].score = null;

  assert.throws(() => reconcileWeeklyResults({
    fixtureSchedule: { week: 1, games: [{ kickoff: "2026-09-10T00:00:00.000Z", homeTeam: "Broncos", awayTeam: "Raiders" }] },
    espnSchedule: { content: { schedule: { "2026-09-10": { games: [game] } } } },
  }), /invalid/i);
});

test("Pick outcomes preserve selected losers and eliminate selected winners or either Team in a tie", () => {
  const outcomes = planPickOutcomes({
    picks: [
      { id: 101, trackId: 1, teamName: "Raiders" },
      { id: 102, trackId: 2, teamName: "Broncos" },
      { id: 103, trackId: 3, teamName: "Chiefs" },
    ],
    games: [
      { homeTeam: "Broncos", awayTeam: "Raiders", status: "FINAL", winnerTeam: "Broncos", loserTeam: "Raiders", tied: false },
      { homeTeam: "Chiefs", awayTeam: "Chargers", status: "FINAL", winnerTeam: null, loserTeam: null, tied: true },
    ],
  });

  assert.deepEqual(outcomes, [
    { pickId: 101, trackId: 1, teamName: "Raiders", outcome: "PREDICTION_CORRECT", eliminated: false },
    { pickId: 102, trackId: 2, teamName: "Broncos", outcome: "WRONG_PICK", eliminated: true },
    { pickId: 103, trackId: 3, teamName: "Chiefs", outcome: "WRONG_PICK", eliminated: true },
  ]);
});

test("an official override supplies the terminal result for its exact Fixture matchup", () => {
  const pending = espnGame({ homeTeam: "Broncos", awayTeam: "Raiders", homeScore: 0, awayScore: 0, completed: false });
  const result = reconcileWeeklyResults({
    fixtureSchedule: { week: 1, games: [{ kickoff: "2026-09-10T00:00:00.000Z", homeTeam: "Broncos", awayTeam: "Raiders" }] },
    espnSchedule: { content: { schedule: { "2026-09-10": { games: [pending] } } } },
    overrides: [{ homeTeam: "Broncos", awayTeam: "Raiders", homeScore: 13, awayScore: 20 }],
  });

  assert.deepEqual(result.games, [{ homeTeam: "Broncos", awayTeam: "Raiders", status: "FINAL", winnerTeam: "Raiders", loserTeam: "Broncos", tied: false }]);
  assert.equal(result.allFinal, true);
});
