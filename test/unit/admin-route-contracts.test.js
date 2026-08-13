const assert = require("node:assert/strict");
const { test } = require("node:test");
const express = require("express");
const request = require("supertest");

const {
  LeagueSeason,
  Track,
  AdminAuditOperation,
} = require("../../models");
const { createAdminActionRouter } = require("../../server/admin/action-routes");
const { createAdminLeagueSeasonRouter } = require("../../server/admin/league-season-routes");
const { createAdminUserWorkspaceRouter } = require("../../server/admin/user-workspace-routes");
const { createAdminFeatureRouter } = require("../../server/admin/feature-routes");
const { createAdminReminderRouter } = require("../../server/admin/reminder-routes");

function authenticatedApp(path, router) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { adminAuthenticated: true };
    next();
  });
  app.use(path, router);
  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({
      error: error.code || "INTERNAL_ERROR",
      message: error.message,
    });
  });
  return app;
}

test("admin User workspace route maps the selected User to one sanitized view", async () => {
  const calls = [];
  const app = authenticatedApp("/users", createAdminUserWorkspaceRouter({
    inspectUserWorkspace: async (userId) => { calls.push(userId); return { user: { id: userId }, tracks: [] }; },
    getFeatureAccess: async () => ({ betaAccess: { enabled: false, stateVersion: 0 } }),
  }));
  const response = await request(app).get("/users/7/workspace");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { user: { id: 7 }, tracks: [], features: { pickRemindersBetaAccess: { enabled: false, stateVersion: 0 } } });
  assert.deepEqual(calls, [7]);
});

test("admin feature route exposes only sanitized release state", async () => {
  const app = authenticatedApp("/features", createAdminFeatureRouter({ getRelease: async () => ({ publicReleased: false, stateVersion: 0 }) }));
  const response = await request(app).get("/features");
  assert.deepEqual(response.body, { features: { pickReminders: { publicReleased: false, stateVersion: 0 } } });
});

test("admin feature route authorizes before release lookup", async () => {
  let called = false;
  const router = createAdminFeatureRouter({ getRelease: async () => { called = true; } });
  const app = express(); app.use((req, _res, next) => { req.session = {}; next(); }); app.use("/features", router);
  assert.equal((await request(app).get("/features")).status, 401);
  assert.equal(called, false);
});

test("admin reminder operations route returns aggregate counts only", async () => {
  const counts = { evaluated: 4, eligible: 2, claimed: 0, accepted: 1, unknown: 1, temporarilyFailed: 0, permanentlyFailed: 0, suppressed: 0, retryExhausted: 0 };
  const app = authenticatedApp("/reminders", createAdminReminderRouter({ getOperationalStatus: async () => ({ counts }) }));
  const response = await request(app).get("/reminders");
  assert.deepEqual(response.body, { counts });
  assert.equal(JSON.stringify(response.body).includes("user"), false);
});

test("admin action audit route returns the newest operations", async (t) => {
  const operations = [{
    id: 88,
    action: "CLOSE_WEEK",
    targets: [{ id: 99 }],
  }];
  t.mock.method(AdminAuditOperation, "findAll", async (query) => {
    assert.deepEqual(query.order, [["id", "DESC"]]);
    assert.equal(query.limit, 100);
    return operations;
  });
  const app = authenticatedApp("/actions", createAdminActionRouter());

  const response = await request(app).get("/actions/audit");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { operations });
});

test("admin action preview maps the action body and manual closure context", async () => {
  const calls = [];
  const app = authenticatedApp("/actions", createAdminActionRouter({
    loadManualClosureContext: async () => ({ leagueSeasonId: 23, week: 4 }),
    createActionPreview: async (...args) => {
      calls.push(args);
      return { confirmationKey: "a".repeat(64) };
    },
  }));

  const response = await request(app)
    .post("/actions/CLOSE_WEEK/preview")
    .send({ reason: "Scores verified" });

  assert.equal(response.status, 201);
  assert.deepEqual(response.body, { confirmationKey: "a".repeat(64) });
  assert.equal(calls[0][0], "CLOSE_WEEK");
  assert.deepEqual(calls[0][1], { reason: "Scores verified" });
  assert.deepEqual(calls[0][2].manualClosureContext, {
    leagueSeasonId: 23,
    week: 4,
  });
});

test("official-result confirmation forwards its phrase and requests closure evaluation", async () => {
  const confirmations = [];
  let evaluations = 0;
  const app = authenticatedApp("/actions", createAdminActionRouter({
    confirmActionPreview: async (...args) => {
      confirmations.push(args);
      return { status: "COMMITTED" };
    },
    requestClosureEvaluation: async () => {
      evaluations += 1;
    },
  }));

  const response = await request(app)
    .post("/actions/OVERRIDE_GAME_RESULT/confirm")
    .send({
      confirmationKey: "a".repeat(64),
      note: "Official result",
      confirmationPhrase: "CONFIRM",
    });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "COMMITTED" });
  assert.equal(confirmations[0][0], "OVERRIDE_GAME_RESULT");
  assert.equal(confirmations[0][1], "a".repeat(64));
  assert.equal(confirmations[0][2], "Official result");
  assert.equal(confirmations[0][3].confirmationPhrase, "CONFIRM");
  assert.equal(evaluations, 1);
});

test("manual reminder preview exposes only the aggregate service contract", async () => {
  const preview = { action: "SEND_PICK_REMINDERS", leagueSeason: { year: 2026 }, round: 3, schedulePhase: "REGULAR", authoritativeDeadline: "2026-09-11T00:00:00.000Z", eligibleDeliveries: { email: 2, push: 1 }, warnings: [], expiresAt: "2026-09-10T20:10:00.000Z", confirmationKey: "a".repeat(64) };
  const app = authenticatedApp("/actions", createAdminActionRouter({
    loadManualReminderContext: async () => ({}),
    createActionPreview: async (action, body, options) => {
      assert.equal(action, "SEND_PICK_REMINDERS"); assert.deepEqual(body, {}); assert.equal(typeof options.loadManualReminderContext, "function"); return preview;
    },
  }));
  const response = await request(app).post("/actions/SEND_PICK_REMINDERS/preview").send({});
  assert.equal(response.status, 201);
  assert.deepEqual(response.body, preview);
  for (const forbidden of ["targets", "recipients", "channels", "message", "picks", "users"]) assert.equal(Object.hasOwn(response.body, forbidden), false);
});

test("manual reminder confirmation returns aggregate audit facts and wakes delivery after commit", async () => {
  let wakeups = 0;
  const app = authenticatedApp("/actions", createAdminActionRouter({
    confirmActionPreview: async () => ({ id: 81, action: "SEND_PICK_REMINDERS", league_season_id: 4, week: 3, summary: { evaluated: 3, eligibleDeliveries: { email: 2, push: 1 } }, targets: [{ userId: 7 }] }),
    requestReminderEvaluation: async () => { wakeups += 1; },
  }));
  const response = await request(app).post("/actions/SEND_PICK_REMINDERS/confirm").send({ confirmationKey: "a".repeat(64) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(response.body, { action: "SEND_PICK_REMINDERS", operationId: 81, leagueSeason: { id: 4, round: 3 }, summary: { evaluated: 3, eligibleDeliveries: { email: 2, push: 1 } } });
  assert.equal(wakeups, 1);
});

test("admin League Season route falls back to the latest completed season", async (t) => {
  const completed = {
    id: 22,
    year: 2025,
    state: "COMPLETE",
    current_week: 22,
    state_version: 31,
  };
  let seasonLookup = 0;
  t.mock.method(LeagueSeason, "findOne", async (query) => {
    seasonLookup += 1;
    if (seasonLookup === 1) {
      assert.deepEqual(query.where, { open_slot: 1 });
      return null;
    }
    assert.deepEqual(query.where, { state: "COMPLETE" });
    assert.deepEqual(query.order, [["year", "DESC"]]);
    return completed;
  });
  t.mock.method(Track, "count", async () => 3);
  const app = authenticatedApp(
    "/league-season",
    createAdminLeagueSeasonRouter()
  );

  const response = await request(app).get("/league-season");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    leagueSeason: {
      id: 22,
      year: 2025,
      state: "COMPLETE",
      week: 22,
      stateVersion: 31,
    },
    unassignedTrackCount: 3,
  });
});
