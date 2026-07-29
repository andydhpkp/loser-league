const assert = require("node:assert/strict");
const { test } = require("node:test");
const bcrypt = require("bcrypt");

const User = require("../../models/User");
const Track = require("../../models/Track");
const Team = require("../../models/Team");

test("User checks passwords and reports win totals", () => {
  const user = User.build({
    first_name: "A",
    last_name: "B",
    username: "ab",
    email: "ab@example.test",
    password: bcrypt.hashSync("correct", 4),
    user_record: [
      { year: 2024, won: true, won_with_tie: false },
      { year: 2025, won: true, won_with_tie: true },
      { year: 2026, won: false, won_with_tie: false },
    ],
  });

  assert.equal(user.checkPassword("correct"), true);
  assert.equal(user.checkPassword("wrong"), false);
  assert.equal(user.getTotalWins(), 2);
  assert.equal(user.getCleanWins(), 1);
  assert.equal(user.getWinsWithTies(), 1);
});

test("User win totals handle missing records", () => {
  const user = User.build({ user_record: null });
  assert.equal(user.getTotalWins(), 0);
  assert.equal(user.getCleanWins(), 0);
  assert.equal(user.getWinsWithTies(), 0);
});

test("User addWin inserts, preserves, and upgrades annual records", async (t) => {
  const user = User.build({ user_record: [] });
  const saved = [];
  t.mock.method(user, "save", async () => {
    saved.push(user.user_record.map((entry) => ({ ...entry })));
    return user;
  });

  await user.addWin(2025);
  await user.addWin(2025);
  await user.addWin(2025, true);

  assert.deepEqual(user.user_record, [
    { year: 2025, won: true, won_with_tie: true },
  ]);
  assert.equal(saved.length, 3);
});

test("Track serializes pick arrays as semicolon-delimited storage", () => {
  const track = Track.build();
  track.available_picks = ["Broncos", "Raiders"];
  track.used_picks = ["Chiefs"];

  assert.equal(track.getDataValue("available_picks"), "Broncos;Raiders");
  assert.equal(track.getDataValue("used_picks"), "Chiefs");
  assert.deepEqual(track.available_picks, ["Broncos", "Raiders"]);
  assert.deepEqual(track.used_picks, ["Chiefs"]);

  track.setDataValue("available_picks", null);
  track.setDataValue("used_picks", "");
  assert.deepEqual(track.available_picks, []);
  assert.deepEqual(track.used_picks, []);
});

test("Team serializes records as comma-delimited storage", () => {
  const team = Team.build();
  team.team_record = [3, 2];

  assert.equal(team.getDataValue("team_record"), "3,2");
  assert.deepEqual(team.team_record, ["3", "2"]);
});
