const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const request = require("supertest");

const { createPickSubmissionRouter } = require("../../server/user/pick-submission-routes");

function appFor({ userId, service }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.session = userId ? { user_id: userId, loggedIn: true } : {}; next(); });
  app.use("/api/user/league", createPickSubmissionRouter(service));
  return app;
}

test("Pick submission routes reject before service lookup", async () => {
  let called = false;
  const service = { getSubmissionState: async () => { called = true; }, submit: async () => { called = true; }, getLeagueView: async () => { called = true; } };
  assert.equal((await request(appFor({ service })).get("/api/user/league/submission")).status, 401);
  assert.equal(called, false);
});

test("Pick submission uses session User and personalized responses are not stored", async () => {
  let received;
  const service = {
    getSubmissionState: async () => ({ tracks: [] }),
    getLeagueView: async () => ({ pickVisibility: "VISIBLE", users: [] }),
    submit: async (input) => { received = input; return { picks: [] }; },
  };
  const app = appFor({ userId: 7, service });
  const response = await request(app).post("/api/user/league/submission").send({ userId: 99, selections: [] });
  assert.equal(response.status, 200);
  assert.equal(received.userId, 7);
  assert.deepEqual(received.selections, []);
  assert.equal(response.headers["cache-control"], "private, no-store");
});
