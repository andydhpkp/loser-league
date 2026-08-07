const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const request = require("supertest");

const { createPickSubmissionRouter } = require("../../server/user/pick-submission-routes");
const { createErrorHandler } = require("../../server/middleware/error-handler");
const { ConflictError } = require("../../server/lib/errors");

function appFor({ userId, service }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.session = userId ? { user_id: userId, loggedIn: true } : {}; next(); });
  app.use("/api/user/league", createPickSubmissionRouter(service));
  app.use(createErrorHandler({ error() {} }));
  return app;
}

test("Pick submission routes reject before service lookup", async () => {
  let called = false;
  const service = { getSubmissionState: async () => { called = true; }, getSupport: async () => { called = true; }, submit: async () => { called = true; }, getLeagueView: async () => { called = true; } };
  assert.equal((await request(appFor({ service })).get("/api/user/league/submission")).status, 401);
  assert.equal((await request(appFor({ service })).get("/api/user/league/support")).status, 401);
  assert.equal(called, false);
});

test("League view returns a private safe conflict without League data while blocked", async () => {
  const service = {
    getLeagueView: async () => { throw new ConflictError("Submit Picks for all active Tracks before viewing the League."); },
  };
  const response = await request(appFor({ userId: 7, service })).get("/api/user/league/view");
  assert.equal(response.status, 409);
  assert.equal(response.headers["cache-control"], "private, no-store");
  assert.deepEqual(response.body, {
    error: "CONFLICT",
    message: "Submit Picks for all active Tracks before viewing the League.",
  });
});

test("Pick submission uses session User and personalized responses are not stored", async () => {
  let received;
  const service = {
    getSubmissionState: async () => ({ tracks: [] }),
    getSupport: async () => ({ contacts: [{ name: "Tate", formattedPhone: "(303) 555-0101", smsUrl: "sms:+13035550101" }] }),
    getLeagueView: async () => ({ pickVisibility: "VISIBLE", users: [] }),
    submit: async (input) => { received = input; return { picks: [] }; },
    decideBuyback: async (input) => { received = input; return { status: "DECLINED_USER" }; },
  };
  const app = appFor({ userId: 7, service });
  const response = await request(app).post("/api/user/league/submission").send({ userId: 99, selections: [] });
  assert.equal(response.status, 200);
  assert.equal(received.userId, 7);
  assert.deepEqual(received.selections, []);
  assert.equal(response.headers["cache-control"], "private, no-store");
  const support = await request(app).get("/api/user/league/support");
  assert.equal(support.status, 200);
  assert.equal(support.body.contacts[0].name, "Tate");
  const decline = await request(app).post("/api/user/league/buyback/decline").send({ userId: 99, stateVersion: 2 });
  assert.equal(decline.status, 200);
  assert.equal(received.userId, 7);
  assert.equal(received.action, "DECLINE");
});
