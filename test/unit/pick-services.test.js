const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  sequelize,
  LeagueSeason,
  LeagueWeekOperation,
  Track,
  Pick,
  ScheduleSnapshot,
} = require("../../models");
const { submitPicks } = require("../../server/modules/picks/submission-service");
const { executeAutoPick } = require("../../server/modules/picks/auto-pick-service");

const now = new Date("2026-09-10T17:00:00.000Z");
const schedule = {
  year: 2026,
  week: 1,
  teams: ["Denver Broncos", "Las Vegas Raiders"],
  earliestKickoff: new Date("2026-09-10T18:00:00.000Z"),
  provider: "FIXTURE_DOWNLOAD",
  contentHash: "b".repeat(64),
  normalizedSchedule: {
    games: [{
      homeTeam: "Denver Broncos",
      awayTeam: "Las Vegas Raiders",
      kickoff: "2026-09-10T18:00:00.000Z",
    }],
  },
  fetchedAt: new Date("2026-09-10T16:00:00.000Z"),
};

function stubTransaction(t) {
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  t.mock.method(sequelize, "transaction", async (_options, callback) => callback(transaction));
  return transaction;
}

function mutableTrack(values) {
  return {
    ...values,
    async update(changes) {
      Object.assign(this, changes);
      return this;
    },
  };
}

test("User submission commits one eligible Pick for every active Track", async (t) => {
  stubTransaction(t);
  const season = {
    id: 23,
    year: 2026,
    state: "ACTIVE",
    current_week: 1,
    pick_cycle: 0,
  };
  const track = mutableTrack({
    id: 17,
    state_version: 3,
    used_picks: [],
    available_picks: [...schedule.teams],
  });
  let pickLookups = 0;
  let committedPick;

  t.mock.method(LeagueSeason, "findOne", async () => season);
  t.mock.method(Track, "findAll", async () => [track]);
  t.mock.method(Pick, "findAll", async () => {
    pickLookups += 1;
    if (pickLookups < 3) return [];
    return [committedPick];
  });
  t.mock.method(ScheduleSnapshot, "findOrCreate", async () => [{ id: 55 }, true]);
  t.mock.method(Pick, "create", async (values) => {
    committedPick = { ...values };
    return committedPick;
  });

  const result = await submitPicks({
    userId: 7,
    selections: [{
      trackId: 17,
      stateVersion: 3,
      teamName: " Las Vegas Raiders ",
    }],
    schedule,
    now,
  });

  assert.equal(committedPick.origin, "USER_SUBMISSION");
  assert.equal(committedPick.outcome, "PENDING");
  assert.equal(track.current_pick, "Las Vegas Raiders");
  assert.deepEqual(track.used_picks, ["Las Vegas Raiders"]);
  assert.deepEqual(track.available_picks, ["Denver Broncos"]);
  assert.equal(track.state_version, 4);
  assert.deepEqual(result, {
    leagueSeasonId: 23,
    week: 1,
    idempotent: false,
    picks: [{
      trackId: 17,
      teamName: "Las Vegas Raiders",
      committedAt: now,
    }],
  });
});

test("automatic selection fills only Tracks missing a current Pick", async (t) => {
  stubTransaction(t);
  const season = {
    id: 23,
    year: 2026,
    state: "ACTIVE",
    current_week: 1,
    pick_cycle: 0,
  };
  const submittedTrack = mutableTrack({
    id: 17,
    current_pick: "Denver Broncos",
    used_picks: ["Denver Broncos"],
    available_picks: ["Las Vegas Raiders"],
    state_version: 4,
  });
  const missingTrack = mutableTrack({
    id: 18,
    current_pick: null,
    used_picks: [],
    available_picks: [...schedule.teams],
    state_version: 2,
  });
  let automaticPick;
  let operationValues;

  t.mock.method(LeagueSeason, "findOne", async () => season);
  t.mock.method(LeagueWeekOperation, "findOne", async () => null);
  t.mock.method(Track, "findAll", async () => [submittedTrack, missingTrack]);
  t.mock.method(Pick, "findAll", async () => [{
    track_id: 17,
    week: 1,
    team_name: "Denver Broncos",
  }]);
  t.mock.method(ScheduleSnapshot, "findOrCreate", async () => [{ id: 55 }, true]);
  t.mock.method(Pick, "create", async (values) => {
    automaticPick = values;
    return values;
  });
  t.mock.method(LeagueWeekOperation, "create", async (values) => {
    operationValues = values;
    return { id: 71 };
  });

  const result = await executeAutoPick({
    schedule,
    now: schedule.earliestKickoff,
    randomIndex: () => 1,
  });

  assert.equal(automaticPick.track_id, 18);
  assert.equal(automaticPick.team_name, "Las Vegas Raiders");
  assert.equal(automaticPick.origin, "AUTOMATIC_SELECTION");
  assert.equal(submittedTrack.state_version, 4);
  assert.equal(missingTrack.current_pick, "Las Vegas Raiders");
  assert.deepEqual(missingTrack.used_picks, ["Las Vegas Raiders"]);
  assert.deepEqual(missingTrack.available_picks, ["Denver Broncos"]);
  assert.equal(missingTrack.state_version, 3);
  assert.deepEqual(operationValues.summary, {
    assignedCount: 1,
    alreadySubmittedCount: 1,
    expiredBuybackCount: 0,
  });
  assert.deepEqual(result, {
    status: "COMPLETED",
    leagueSeasonId: 23,
    week: 1,
    assignedCount: 1,
    expiredBuybackCount: 0,
  });
});
