const assert = require("node:assert/strict");
const test = require("node:test");
const sequelize = require("../../config/connection");
const {
  LeagueSeason,
  Team,
  Track,
  User,
} = require("../../models");
const {
  createTracksInBulk,
  normalizeAdditions,
} = require("../../server/admin/bulk-track-service");

test("bulk Track quantities normalize valid input", () => {
  assert.deepEqual(normalizeAdditions([{ userId: "3", quantity: "10" }]), [{ userId: 3, quantity: 10 }]);
});

test("bulk Track quantities reject empty, duplicate, fractional, and excessive requests", () => {
  for (const additions of [
    [],
    [{ userId: 3, quantity: 0 }],
    [{ userId: 3, quantity: 1.5 }],
    [{ userId: 3, quantity: 101 }],
    [{ userId: 3, quantity: 1 }, { userId: 3, quantity: 2 }],
  ]) assert.throws(() => normalizeAdditions(additions));
});

test("bulk Track creation seeds the current Team pool and returns a User summary", async (t) => {
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  let createdRows;

  t.mock.method(sequelize, "transaction", async (callback) => callback(transaction));
  t.mock.method(LeagueSeason, "findOne", async () => ({
    id: 23,
    year: 2026,
    state: "SETUP",
    current_week: 0,
  }));
  t.mock.method(User, "findAll", async () => [
    {
      id: 7,
      first_name: "Alex",
      last_name: "Viewer",
      username: "alex",
    },
    {
      id: 8,
      first_name: "Taylor",
      last_name: "Opponent",
      username: "taylor",
    },
  ]);
  t.mock.method(Team, "findAll", async () => [
    { team_name: "Denver Broncos" },
    { team_name: "Las Vegas Raiders" },
  ]);
  t.mock.method(Track, "bulkCreate", async (rows) => {
    createdRows = rows;
    return rows;
  });

  const result = await createTracksInBulk([
    { userId: 7, quantity: 2 },
    { userId: 8, quantity: 1 },
  ]);

  assert.equal(createdRows.length, 3);
  assert.deepEqual(createdRows, [
    {
      user_id: 7,
      league_season_id: 23,
      available_picks: ["Denver Broncos", "Las Vegas Raiders"],
      used_picks: [],
      current_pick: null,
      wrong_pick: null,
      state_version: 0,
    },
    {
      user_id: 7,
      league_season_id: 23,
      available_picks: ["Denver Broncos", "Las Vegas Raiders"],
      used_picks: [],
      current_pick: null,
      wrong_pick: null,
      state_version: 0,
    },
    {
      user_id: 8,
      league_season_id: 23,
      available_picks: ["Denver Broncos", "Las Vegas Raiders"],
      used_picks: [],
      current_pick: null,
      wrong_pick: null,
      state_version: 0,
    },
  ]);
  assert.deepEqual(result, {
    leagueSeason: { year: 2026, week: 0 },
    totalCreated: 3,
    additions: [
      {
        userId: 7,
        quantity: 2,
        displayName: "Alex Viewer",
        username: "alex",
      },
      {
        userId: 8,
        quantity: 1,
        displayName: "Taylor Opponent",
        username: "taylor",
      },
    ],
  });
});
