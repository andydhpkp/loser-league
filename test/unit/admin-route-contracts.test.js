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
  }));
  const response = await request(app).get("/users/7/workspace");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { user: { id: 7 }, tracks: [] });
  assert.deepEqual(calls, [7]);
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
