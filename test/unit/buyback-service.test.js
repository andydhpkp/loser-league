const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  sequelize,
  User,
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
  completeAdminDirect,
  listAdmin,
  expireAtDeadlineLocked,
  assertPickAllowedLocked,
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

test("later-week preseason Wrong Pick materializes without a deadline and blocks Picks", async (t) => {
  const transaction = stubTransaction(t);
  const season = { id: 23, state: "ACTIVE", current_week: 4, schedule_phase: "PRESEASON" };
  const decision = mutableDecision({ id: 41, status: "ELIGIBLE", state_version: 0 });
  const track = { id: 17, eliminated_by_pick_id: 29 };
  const pick = { id: 29, week: 3, outcome: "WRONG_PICK", team_name: "Denver Broncos" };

  t.mock.method(LeagueSeason, "findOne", async () => season);
  t.mock.method(BuybackDecision, "findOne", async () => null);
  t.mock.method(Track, "findAll", async () => [track]);
  t.mock.method(Pick, "findAll", async () => [pick]);
  t.mock.method(BuybackDecision, "create", async () => decision);
  t.mock.method(BuybackDecisionTrack, "findAll", async () => []);

  const view = await getUserBuyback({ userId: 7, deadlineAvailable: false, deadline: null, now: new Date("2026-08-30T20:00:00.000Z") });
  const gate = await assertPickAllowedLocked({ userId: 7, season, now: new Date("2026-08-30T20:00:00.000Z"), transaction });

  assert.equal(view.status, "ELIGIBLE");
  assert.equal(view.pickBlocked, true);
  assert.equal(view.schedulePhase, "PRESEASON");
  assert.deepEqual(view.tracks, [{ trackId: 17, weekOnePick: "Denver Broncos", resolution: null }]);
  assert.deepEqual(gate, { allowed: false, status: "ELIGIBLE" });
});

test("preseason buyback decisions do not expire at a deadline", async (t) => {
  stubTransaction(t);
  const season = { id: 23, state: "ACTIVE", current_week: 4, schedule_phase: "PRESEASON" };
  const decision = mutableDecision({ id: 41, status: "PENDING_USER_REQUEST", state_version: 2 });
  t.mock.method(LeagueSeason, "findOne", async () => season);
  t.mock.method(BuybackDecision, "findOne", async () => decision);
  t.mock.method(BuybackDecisionTrack, "findAll", async () => [{ track_id: 17, resolution: "PENDING", weekOnePick: { team_name: "Broncos" } }]);
  t.mock.method(BuybackDecisionTrack, "update", async () => { throw new Error("preseason decisions must not expire"); });

  const view = await getUserBuyback({ userId: 7, deadlineAvailable: false, deadline: new Date("2026-08-01T00:00:00.000Z"), now: new Date("2026-08-30T20:00:00.000Z") });

  assert.equal(view.status, "PENDING_USER_REQUEST");
  assert.equal(view.pickBlocked, true);
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
  const season = { id: 23, state: "ACTIVE", current_week: 2 };
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

test("admin directly completes an eligible Buyback Decision for exact Tracks", async (t) => {
  stubTransaction(t);
  const season = { id: 23, state: "ACTIVE", current_week: 2 };
  const decision = mutableDecision({
    id: 41,
    user_id: 7,
    league_season_id: 23,
    status: "ELIGIBLE",
    state_version: 0,
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
    team_name: "Denver Broncos",
  };
  let memberValues;

  t.mock.method(LeagueSeason, "findOne", async () => season);
  t.mock.method(ScheduleSnapshot, "findOne", async () => ({
    normalized_schedule: {
      games: [{ kickoff: "2026-09-20T18:00:00.000Z" }],
    },
  }));
  t.mock.method(BuybackDecision, "findOne", async () => decision);
  t.mock.method(Track, "findAll", async () => [track]);
  t.mock.method(Pick, "findAll", async () => [pick]);
  t.mock.method(AdminAuditOperation, "create", async () => ({ id: 88 }));
  t.mock.method(Track, "findByPk", async () => track);
  t.mock.method(Pick, "findByPk", async () => pick);
  t.mock.method(TrackReactivation, "create", async () => ({ id: 99 }));
  t.mock.method(BuybackDecisionTrack, "create", async (values) => {
    memberValues = values;
    return values;
  });

  const result = await completeAdminDirect({
    userId: 7,
    trackIds: [17],
    stateVersion: 0,
    paymentConfirmed: true,
    now: new Date("2026-09-20T17:00:00.000Z"),
  });

  assert.deepEqual(memberValues, {
    buyback_decision_id: 41,
    track_id: 17,
    week_one_pick_id: 29,
    resolution: "FULFILLED",
    track_reactivation_id: 99,
  });
  assert.equal(track.eliminated_by_pick_id, null);
  assert.equal(decision.status, "COMPLETED_ADMIN_DIRECT");
  assert.equal(decision.origin, "ADMIN");
  assert.equal(decision.admin_audit_operation_id, 88);
  assert.equal(decision.state_version, 1);
  assert.deepEqual(result, {
    idempotent: false,
    status: "COMPLETED_ADMIN_DIRECT",
    stateVersion: 1,
    fulfilledTrackIds: [17],
  });
});

test("admin Buyback Decision history returns sanitized Users and resolved Tracks", async (t) => {
  const resolvedAt = new Date("2026-09-20T17:00:00.000Z");
  const decision = {
    id: 41,
    user_id: 7,
    status: "COMPLETED_USER_REQUEST",
    state_version: 4,
    requested_at: new Date("2026-09-20T16:00:00.000Z"),
    resolved_at: resolvedAt,
    user: {
      id: 7,
      first_name: "Alex",
      last_name: "Viewer",
      username: "alex",
      get password() {
        throw new Error("Buyback history must not read User credentials");
      },
    },
  };

  t.mock.method(LeagueSeason, "findOne", async () => ({ id: 23 }));
  t.mock.method(BuybackDecision, "findAll", async () => [decision]);
  t.mock.method(BuybackDecisionTrack, "findAll", async () => [{
    track_id: 17,
    resolution: "FULFILLED",
    weekOnePick: { team_name: "Denver Broncos" },
  }]);
  t.mock.method(User, "findAll", async () => {
    throw new Error("history must not materialize eligible Users");
  });

  const history = await listAdmin({ view: "history" });

  assert.deepEqual(history, [{
    id: 41,
    status: "COMPLETED_USER_REQUEST",
    stateVersion: 4,
    requestedAt: decision.requested_at,
    resolvedAt,
    user: {
      id: 7,
      displayName: "Alex Viewer",
      username: "alex",
    },
    tracks: [{
      trackId: 17,
      teamName: "Denver Broncos",
      resolution: "FULFILLED",
    }],
  }]);
  assert.equal("password" in history[0].user, false);
});

test("Week 2 deadline expires every unresolved User Buyback Decision", async (t) => {
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  const season = { id: 23, state: "ACTIVE", current_week: 2 };
  const first = mutableDecision({
    id: 41,
    status: "ELIGIBLE",
    state_version: 0,
  });
  const second = mutableDecision({
    id: 42,
    status: "PENDING_USER_REQUEST",
    state_version: 2,
  });
  let lookup = 0;
  const updatedDecisionTracks = [];

  t.mock.method(User, "findAll", async () => [{ id: 7 }, { id: 8 }]);
  t.mock.method(BuybackDecision, "findOne", async () => {
    lookup += 1;
    return lookup === 1 ? first : second;
  });
  t.mock.method(BuybackDecisionTrack, "update", async (_values, query) => {
    updatedDecisionTracks.push(query.where.buyback_decision_id);
  });

  const now = new Date("2026-09-20T18:00:00.000Z");
  const expired = await expireAtDeadlineLocked({
    season,
    now,
    transaction,
  });

  assert.equal(expired, 2);
  assert.deepEqual(updatedDecisionTracks, [41, 42]);
  assert.equal(first.status, "EXPIRED_DEADLINE");
  assert.equal(first.state_version, 1);
  assert.equal(second.status, "EXPIRED_DEADLINE");
  assert.equal(second.state_version, 3);
  assert.equal(first.resolved_at, now);
  assert.equal(second.resolved_at, now);
});
