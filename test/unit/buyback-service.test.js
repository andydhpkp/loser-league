const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  sequelize,
  LeagueSeason,
  Track,
  Pick,
  BuybackDecision,
  BuybackDecisionTrack,
  TrackReactivation,
  AdminAuditOperation,
  ScheduleSnapshot,
} = require("../../models");
const {
  getUserBuyback,
  decide,
  resolveAdmin,
} = require("../../server/modules/buyback/buyback-service");

function stubTransaction(t) {
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  t.mock.method(sequelize, "transaction", async (_options, callback) => callback(transaction));
  return transaction;
}

function mutableDecision(values) {
  return {
    ...values,
    async update(changes) {
      Object.assign(this, changes);
      return this;
    },
  };
}

test("User has no Buyback Decision without an open League Season", async (t) => {
  stubTransaction(t);
  t.mock.method(LeagueSeason, "findOne", async () => null);

  const view = await getUserBuyback({
    userId: 7,
    deadlineAvailable: false,
    deadline: null,
  });

  assert.equal(view, null);
});

test("Week 1 Wrong Pick materializes one blocking Buyback Decision", async (t) => {
  stubTransaction(t);
  const season = { id: 23, state: "ACTIVE", current_week: 2 };
  const decision = mutableDecision({
    id: 41,
    status: "ELIGIBLE",
    state_version: 0,
  });
  const track = { id: 17, eliminated_by_pick_id: 29 };
  const pick = { id: 29, week: 1, outcome: "WRONG_PICK", team_name: "Denver Broncos" };

  t.mock.method(LeagueSeason, "findOne", async () => season);
  t.mock.method(BuybackDecision, "findOne", async () => null);
  t.mock.method(Track, "findAll", async () => [track]);
  t.mock.method(Pick, "findAll", async () => [pick]);
  t.mock.method(Pick, "findOne", async () => null);
  t.mock.method(BuybackDecision, "create", async (values) => {
    assert.deepEqual(values, {
      user_id: 7,
      league_season_id: 23,
      status: "ELIGIBLE",
      origin: "SYSTEM",
      unit_price_cents: 1000,
      state_version: 0,
      resolved_at: null,
    });
    return decision;
  });
  t.mock.method(BuybackDecisionTrack, "findAll", async () => []);

  const view = await getUserBuyback({
    userId: 7,
    deadlineAvailable: true,
    deadline: new Date("2026-09-20T18:00:00.000Z"),
    now: new Date("2026-09-20T17:00:00.000Z"),
    presentation: {
      contacts: [{ label: "Commissioner", href: "mailto:league@example.test" }],
      payment: { label: "Venmo", href: "https://example.test/pay" },
    },
  });

  assert.deepEqual(view, {
    status: "ELIGIBLE",
    stateVersion: 0,
    pickBlocked: true,
    unitPriceCents: 1000,
    selectedCount: 0,
    totalCents: 0,
    tracks: [{ trackId: 17, weekOnePick: "Denver Broncos", resolution: null }],
    contacts: [{ label: "Commissioner", href: "mailto:league@example.test" }],
    payment: { label: "Venmo", href: "https://example.test/pay" },
  });
});

test("deadline expires a pending Buyback Decision and its unresolved Tracks", async (t) => {
  stubTransaction(t);
  const season = { id: 23, state: "ACTIVE", current_week: 2 };
  const decision = mutableDecision({
    id: 41,
    status: "PENDING_USER_REQUEST",
    state_version: 3,
  });
  const updatedTracks = [];

  t.mock.method(LeagueSeason, "findOne", async () => season);
  t.mock.method(BuybackDecision, "findOne", async () => decision);
  t.mock.method(BuybackDecisionTrack, "update", async (values, query) => {
    updatedTracks.push({ values, query });
  });
  t.mock.method(BuybackDecisionTrack, "findAll", async () => [{
    track_id: 17,
    resolution: "UNFULFILLED",
    weekOnePick: { team_name: "Denver Broncos" },
  }]);

  const now = new Date("2026-09-20T18:00:00.000Z");
  const view = await getUserBuyback({
    userId: 7,
    deadlineAvailable: true,
    deadline: now,
    now,
  });

  assert.equal(decision.status, "EXPIRED_DEADLINE");
  assert.equal(decision.origin, "DEADLINE");
  assert.equal(decision.resolved_at, now);
  assert.equal(decision.state_version, 4);
  assert.deepEqual(updatedTracks, [{
    values: { resolution: "UNFULFILLED" },
    query: {
      where: {
        buyback_decision_id: 41,
        resolution: "PENDING",
      },
      transaction: { LOCK: { UPDATE: "UPDATE" } },
    },
  }]);
  assert.deepEqual(view, {
    status: "EXPIRED_DEADLINE",
    stateVersion: 4,
    pickBlocked: false,
    unitPriceCents: 1000,
    selectedCount: 1,
    totalCents: 1000,
    tracks: [{ trackId: 17, weekOnePick: "Denver Broncos", resolution: "UNFULFILLED" }],
    contacts: [],
    payment: null,
  });
});

test("User requests exact eligible Tracks with optimistic Buyback Decision state", async (t) => {
  stubTransaction(t);
  const season = { id: 23, state: "ACTIVE", current_week: 2 };
  const decision = mutableDecision({
    id: 41,
    status: "ELIGIBLE",
    state_version: 2,
  });
  const createdMembers = [];

  t.mock.method(LeagueSeason, "findOne", async () => season);
  t.mock.method(BuybackDecision, "findOne", async () => decision);
  t.mock.method(Track, "findAll", async () => [
    { id: 17, eliminated_by_pick_id: 29 },
    { id: 18, eliminated_by_pick_id: 30 },
  ]);
  t.mock.method(Pick, "findAll", async () => [
    { id: 29, week: 1, outcome: "WRONG_PICK", team_name: "Denver Broncos" },
    { id: 30, week: 1, outcome: "WRONG_PICK", team_name: "Las Vegas Raiders" },
  ]);
  t.mock.method(BuybackDecisionTrack, "create", async (values) => {
    createdMembers.push(values);
  });

  const now = new Date("2026-09-20T17:00:00.000Z");
  const result = await decide({
    userId: 7,
    action: "REQUEST",
    trackIds: [18, 17],
    stateVersion: 2,
    deadline: new Date("2026-09-20T18:00:00.000Z"),
    now,
  });

  assert.deepEqual(createdMembers, [
    {
      buyback_decision_id: 41,
      track_id: 17,
      week_one_pick_id: 29,
      resolution: "PENDING",
    },
    {
      buyback_decision_id: 41,
      track_id: 18,
      week_one_pick_id: 30,
      resolution: "PENDING",
    },
  ]);
  assert.equal(decision.status, "PENDING_USER_REQUEST");
  assert.equal(decision.origin, "USER");
  assert.equal(decision.requested_at, now);
  assert.equal(decision.state_version, 3);
  assert.deepEqual(result, {
    idempotent: false,
    status: "PENDING_USER_REQUEST",
    stateVersion: 3,
  });
});

test("repeating the same Buyback Decision request is idempotent", async (t) => {
  stubTransaction(t);
  const season = { id: 23, state: "ACTIVE", current_week: 2 };
  const decision = mutableDecision({
    id: 41,
    status: "PENDING_USER_REQUEST",
    state_version: 3,
  });

  t.mock.method(LeagueSeason, "findOne", async () => season);
  t.mock.method(BuybackDecision, "findOne", async () => decision);
  t.mock.method(BuybackDecisionTrack, "findAll", async () => [
    { track_id: 18 },
    { track_id: 17 },
  ]);

  const result = await decide({
    userId: 7,
    action: "REQUEST",
    trackIds: [17, 18],
    stateVersion: 2,
    deadline: new Date("2026-09-20T18:00:00.000Z"),
    now: new Date("2026-09-20T17:00:00.000Z"),
  });

  assert.deepEqual(result, {
    idempotent: true,
    status: "PENDING_USER_REQUEST",
    stateVersion: 3,
  });
});

test("User can decline an eligible Buyback Decision", async (t) => {
  stubTransaction(t);
  const season = { id: 23, state: "ACTIVE", current_week: 2 };
  const decision = mutableDecision({
    id: 41,
    status: "ELIGIBLE",
    state_version: 0,
  });

  t.mock.method(LeagueSeason, "findOne", async () => season);
  t.mock.method(BuybackDecision, "findOne", async () => decision);
  t.mock.method(Track, "findAll", async () => []);

  const now = new Date("2026-09-20T17:00:00.000Z");
  const result = await decide({
    userId: 7,
    action: "DECLINE",
    stateVersion: 0,
    deadline: new Date("2026-09-20T18:00:00.000Z"),
    now,
  });

  assert.equal(decision.status, "DECLINED_USER");
  assert.equal(decision.origin, "USER");
  assert.equal(decision.resolved_at, now);
  assert.equal(decision.state_version, 1);
  assert.deepEqual(result, {
    idempotent: false,
    status: "DECLINED_USER",
    stateVersion: 1,
  });
});

test("admin partially fulfills a pending Buyback Decision atomically", async (t) => {
  stubTransaction(t);
  const season = { id: 23, current_week: 2 };
  const decision = mutableDecision({
    id: 41,
    user_id: 7,
    league_season_id: 23,
    status: "PENDING_USER_REQUEST",
    state_version: 3,
  });
  const fulfilledMember = mutableDecision({
    track_id: 17,
    week_one_pick_id: 29,
    resolution: "PENDING",
  });
  const unfulfilledMember = mutableDecision({
    track_id: 18,
    week_one_pick_id: 30,
    resolution: "PENDING",
  });
  const track = mutableDecision({
    id: 17,
    user_id: 7,
    league_season_id: 23,
    eliminated_by_pick_id: 29,
    wrong_pick: "Denver Broncos",
    state_version: 5,
  });
  const pick = {
    id: 29,
    week: 1,
    outcome: "WRONG_PICK",
  };
  let auditValues;
  let reactivationValues;

  t.mock.method(LeagueSeason, "findOne", async () => season);
  t.mock.method(ScheduleSnapshot, "findOne", async () => ({
    normalized_schedule: {
      games: [{ kickoff: "2026-09-20T18:00:00.000Z" }],
    },
  }));
  t.mock.method(BuybackDecision, "findByPk", async () => decision);
  t.mock.method(BuybackDecisionTrack, "findAll", async () => [
    fulfilledMember,
    unfulfilledMember,
  ]);
  t.mock.method(AdminAuditOperation, "create", async (values) => {
    auditValues = values;
    return { id: 88 };
  });
  t.mock.method(Track, "findByPk", async () => track);
  t.mock.method(Pick, "findByPk", async () => pick);
  t.mock.method(TrackReactivation, "create", async (values) => {
    reactivationValues = values;
    return { id: 99 };
  });

  const now = new Date("2026-09-20T17:00:00.000Z");
  const result = await resolveAdmin({
    decisionId: 41,
    stateVersion: 3,
    fulfilledTrackIds: [17],
    paymentConfirmed: true,
    now,
  });

  assert.deepEqual(auditValues, {
    action: "COMPLETE_BUYBACK_REQUEST",
    description: "Resolve Week 2 buyback decision 41",
    status: "COMMITTED",
    league_season_id: 23,
    week: 2,
    summary: {
      fulfilledCount: 1,
      unfulfilledCount: 1,
      totalCents: 1000,
    },
    undoable: false,
    created_at: now,
  });
  assert.deepEqual(reactivationValues, {
    track_id: 17,
    league_season_id: 23,
    waived_pick_id: 29,
    admin_audit_operation_id: 88,
  });
  assert.equal(track.eliminated_by_pick_id, null);
  assert.equal(track.wrong_pick, null);
  assert.equal(track.state_version, 6);
  assert.equal(fulfilledMember.resolution, "FULFILLED");
  assert.equal(fulfilledMember.track_reactivation_id, 99);
  assert.equal(unfulfilledMember.resolution, "UNFULFILLED");
  assert.equal(unfulfilledMember.track_reactivation_id, null);
  assert.equal(decision.status, "COMPLETED_USER_REQUEST");
  assert.equal(decision.origin, "ADMIN");
  assert.equal(decision.admin_audit_operation_id, 88);
  assert.equal(decision.state_version, 4);
  assert.deepEqual(result, {
    idempotent: false,
    status: "COMPLETED_USER_REQUEST",
    stateVersion: 4,
    fulfilledTrackIds: [17],
  });
});
