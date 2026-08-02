const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  sequelize,
  LeagueSeason,
  Track,
  Pick,
  ScheduleSnapshot,
  LeagueWeekOperation,
  AdminAuditOperation,
  AdminAuditTarget,
} = require("../../models");
const { closeWeek } = require("../../server/modules/week-closure/week-closure-service");

const scheduleHash = "a".repeat(64);
const games = [{
  homeTeam: "Denver Broncos",
  awayTeam: "Las Vegas Raiders",
  status: "FINAL",
  winnerTeam: "Denver Broncos",
  loserTeam: "Las Vegas Raiders",
  tied: false,
}];

test("week closure rejects invalid League Season identity and mode", async () => {
  await assert.rejects(
    closeWeek({
      leagueSeasonId: "23",
      week: 4,
      scheduleHash,
      mode: "EMERGENCY",
      games,
    }),
    (error) => error.code === "VALIDATION_ERROR"
  );
});

test("week closure rejects an invalid schedule hash and game payload", async () => {
  await assert.rejects(
    closeWeek({
      leagueSeasonId: 23,
      week: 4,
      scheduleHash: "not-a-hash",
      mode: "AUTOMATIC",
      games: null,
    }),
    (error) => error.code === "VALIDATION_ERROR"
  );
});

test("week closure opens its transaction and returns an existing completion idempotently", async (t) => {
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  t.mock.method(sequelize, "transaction", async (_options, callback) => callback(transaction));
  t.mock.method(LeagueSeason, "findByPk", async () => ({
    id: 23,
    state: "ACTIVE",
    current_week: 4,
  }));
  t.mock.method(LeagueWeekOperation, "findOne", async () => ({ id: 72 }));

  const result = await closeWeek({
    leagueSeasonId: 23,
    week: 4,
    scheduleHash,
    mode: "AUTOMATIC",
    games,
  });

  assert.deepEqual(result, {
    status: "ALREADY_COMPLETED",
    leagueSeasonId: 23,
    week: 4,
    operationId: 72,
  });
});

function mutableRow(values) {
  return {
    ...values,
    async update(changes) {
      Object.assign(this, changes);
      return this;
    },
  };
}

function closureFixture(t, { mode = "AUTOMATIC" } = {}) {
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  const season = mutableRow({
    id: 23,
    year: 2026,
    state: "ACTIVE",
    current_week: 4,
    state_version: 8,
  });
  const tracks = [
    mutableRow({ id: 17, current_pick: "Las Vegas Raiders", wrong_pick: null, eliminated_by_pick_id: null, state_version: 3 }),
    mutableRow({ id: 18, current_pick: "Denver Broncos", wrong_pick: null, eliminated_by_pick_id: null, state_version: 5 }),
  ];
  const picks = [
    mutableRow({ id: 29, track_id: 17, team_name: "Las Vegas Raiders", outcome: "PENDING", state_version: 1 }),
    mutableRow({ id: 30, track_id: 18, team_name: "Denver Broncos", outcome: "PENDING", state_version: 2 }),
  ];
  const normalized_schedule = { games: games.map(({ homeTeam, awayTeam }) => ({ homeTeam, awayTeam })) };
  let operationLookup = 0;

  t.mock.method(LeagueSeason, "findByPk", async () => season);
  t.mock.method(LeagueWeekOperation, "findOne", async () => {
    operationLookup += 1;
    return operationLookup === 1 ? null : { id: 71, schedule_hash: scheduleHash };
  });
  t.mock.method(ScheduleSnapshot, "findOne", async () => ({ normalized_schedule }));
  t.mock.method(Track, "findAll", async () => tracks);
  t.mock.method(Pick, "findAll", async () => picks);
  t.mock.method(LeagueWeekOperation, "create", async (values) => {
    assert.deepEqual(values.summary, {
      processedCount: 2,
      eliminatedCount: 1,
      survivingCount: 1,
      advancedToWeek: 5,
    });
    return { id: 72 };
  });

  if (mode === "MANUAL") {
    t.mock.method(AdminAuditOperation, "create", async () => ({ id: 88 }));
    t.mock.method(AdminAuditTarget, "create", async () => ({ id: 89 }));
  }

  return { transaction, season, tracks, picks };
}

test("automatic week closure settles Picks and advances the League Season once", async (t) => {
  const { transaction, season, tracks, picks } = closureFixture(t);
  const now = new Date("2026-10-04T23:00:00.000Z");

  const result = await closeWeek({
    leagueSeasonId: 23,
    week: 4,
    scheduleHash,
    mode: "AUTOMATIC",
    games,
    now,
    transaction,
  });

  assert.equal(picks[0].outcome, "PREDICTION_CORRECT");
  assert.equal(picks[0].state_version, 2);
  assert.equal(picks[1].outcome, "WRONG_PICK");
  assert.equal(picks[1].state_version, 3);
  assert.deepEqual({
    currentPick: tracks[0].current_pick,
    wrongPick: tracks[0].wrong_pick,
    eliminatedByPickId: tracks[0].eliminated_by_pick_id,
    stateVersion: tracks[0].state_version,
  }, {
    currentPick: null,
    wrongPick: null,
    eliminatedByPickId: null,
    stateVersion: 4,
  });
  assert.deepEqual({
    currentPick: tracks[1].current_pick,
    wrongPick: tracks[1].wrong_pick,
    eliminatedByPickId: tracks[1].eliminated_by_pick_id,
    stateVersion: tracks[1].state_version,
  }, {
    currentPick: null,
    wrongPick: "Denver Broncos",
    eliminatedByPickId: 30,
    stateVersion: 6,
  });
  assert.equal(season.current_week, 5);
  assert.equal(season.state_version, 9);
  assert.deepEqual(result, {
    status: "COMPLETED",
    leagueSeasonId: 23,
    week: 4,
    operationId: 72,
    auditOperationId: null,
    processedCount: 2,
    eliminatedCount: 1,
    advancedToWeek: 5,
  });
});

test("manual week closure records its admin audit and League Season state transition", async (t) => {
  const { transaction } = closureFixture(t, { mode: "MANUAL" });
  let auditValues;
  let targetValues;
  AdminAuditOperation.create.mock.mockImplementation(async (values) => {
    auditValues = values;
    return { id: 88 };
  });
  AdminAuditTarget.create.mock.mockImplementation(async (values) => {
    targetValues = values;
    return { id: 89 };
  });

  const result = await closeWeek({
    leagueSeasonId: 23,
    week: 4,
    scheduleHash,
    mode: "MANUAL",
    games,
    adminNote: "Confirmed final scores",
    transaction,
  });

  assert.equal(auditValues.action, "CLOSE_WEEK");
  assert.equal(auditValues.note, "Confirmed final scores");
  assert.deepEqual(auditValues.summary, {
    processedCount: 2,
    eliminatedCount: 1,
    advancedToWeek: 5,
  });
  assert.deepEqual(targetValues.before_state, { week: 4, stateVersion: 8 });
  assert.deepEqual(targetValues.after_state, { week: 5, stateVersion: 9 });
  assert.equal(result.auditOperationId, 88);
});
