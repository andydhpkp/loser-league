const assert = require("node:assert/strict");
const { test } = require("node:test");
const bcrypt = require("bcrypt");

const User = require("../../models/User");
const Track = require("../../models/Track");
const Team = require("../../models/Team");
const LeagueSeason = require("../../models/LeagueSeason");
const Pick = require("../../models/Pick");

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

test("User derives and serializes extensible crown types from career wins", () => {
  const cases = [
    { user_record: null, crownType: null },
    { user_record: [], crownType: null },
    {
      user_record: [{ year: 2024, won: false, won_with_tie: true }],
      crownType: null,
    },
    {
      user_record: [{ year: 2024, won: true, won_with_tie: false }],
      crownType: "solo_1",
    },
    {
      user_record: [{ year: 2024, won: true, won_with_tie: true }],
      crownType: "tied_1",
    },
    {
      user_record: [
        { year: 2024, won: true, won_with_tie: false },
        { year: 2025, won: true, won_with_tie: false },
      ],
      crownType: "solo_2",
    },
    {
      user_record: [
        { year: 2024, won: true, won_with_tie: true },
        { year: 2025, won: true, won_with_tie: false },
      ],
      crownType: "solo_1_tied_1",
    },
  ];

  for (const { user_record, crownType } of cases) {
    const user = User.build({ user_record });
    assert.equal(user.getCrownType(), crownType);
    assert.equal(user.toJSON().crown_type, crownType);
  }
});

test("User addWin inserts, preserves, and upgrades annual records", async (t) => {
  const user = User.build({ user_record: [] });
  const initialRecord = user.user_record;
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
  assert.notEqual(user.user_record, initialRecord);
  assert.equal(user.crown_type, "tied_1");
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

test("League Season validates setup and active week boundaries", async () => {
  await LeagueSeason.build({
    year: 2026,
    state: "SETUP",
    current_week: 0,
    state_version: 0,
    open_slot: 1,
  }).validate();
  await LeagueSeason.build({
    year: 2026,
    state: "ACTIVE",
    current_week: 1,
    state_version: 1,
    open_slot: 1,
  }).validate();

  await assert.rejects(
    LeagueSeason.build({
      year: 2026,
      state: "SETUP",
      current_week: 1,
      state_version: 0,
      open_slot: 1,
    }).validate(),
    /Week 0/
  );
  await assert.rejects(
    LeagueSeason.build({
      year: 2026,
      state: "ACTIVE",
      current_week: 0,
      state_version: 1,
      open_slot: 1,
    }).validate(),
    /active week/
  );
  await assert.rejects(
    LeagueSeason.build({
      year: 2026,
      state: "COMPLETE",
      current_week: 12,
      state_version: 2,
      open_slot: 1,
    }).validate(),
    /open slot/
  );
});

test("Pick validates explicit week, origin, and outcome", async () => {
  await Pick.build({
    track_id: 10,
    league_season_id: 2,
    week: 1,
    team_name: "Broncos",
    origin: "USER_SUBMISSION",
    outcome: "PENDING",
  }).validate();

  await assert.rejects(
    Pick.build({
      track_id: 10,
      league_season_id: 2,
      week: 0,
      team_name: "Broncos",
      origin: "USER_SUBMISSION",
      outcome: "PENDING",
    }).validate(),
    /week/
  );
  await assert.rejects(
    Pick.build({
      track_id: 10,
      league_season_id: 2,
      week: 1,
      team_name: "Broncos",
      origin: "BROWSER_GUESS",
      outcome: "PENDING",
    }).validate()
  );
});

test("model graph exposes League Season, Pick history, and elimination associations", () => {
  const models = require("../../models/my-index");

  assert.equal(models.Track.associations.leagueSeason.target, models.LeagueSeason);
  assert.equal(models.Track.associations.picks.target, models.Pick);
  assert.equal(models.Track.associations.eliminatingPick.target, models.Pick);
  assert.equal(models.Pick.associations.track.target, models.Track);
  assert.equal(models.Pick.associations.leagueSeason.target, models.LeagueSeason);
  assert.equal(
    models.ScheduleSnapshot.associations.leagueSeason.target,
    models.LeagueSeason
  );
  assert.equal(
    models.LeagueWeekOperation.associations.leagueSeason.target,
    models.LeagueSeason
  );
});

test("League week operation validates exactly-once lifecycle phases", async () => {
  const { LeagueWeekOperation } = require("../../models/my-index");
  await LeagueWeekOperation.build({
    league_season_id: 2,
    week: 3,
    phase: "CLOSE_WEEK",
    mode: "AUTOMATIC",
    summary: {},
    completed_at: new Date(),
  }).validate();
  await assert.rejects(
    LeagueWeekOperation.build({
      league_season_id: 2,
      week: 3,
      phase: "ADVANCE_AGAIN",
      mode: "AUTOMATIC",
      summary: {},
      completed_at: new Date(),
    }).validate()
  );
});

test("admin action persistence has no User or actor association", () => {
  const models = require("../../models/my-index");

  assert.equal(models.AdminActionPreview.associations.leagueSeason.target, models.LeagueSeason);
  assert.equal(models.AdminAuditOperation.associations.targets.target, models.AdminAuditTarget);
  assert.equal(models.AdminActionPreview.rawAttributes.actor_id, undefined);
  assert.equal(models.AdminAuditOperation.rawAttributes.actor_id, undefined);
});
