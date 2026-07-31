const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const request = require("supertest");

const { createApp } = require("../../server/app");
const { Team, User } = require("../../models/my-index");

test("PUT /api/teams/reset-records reaches the named route", async (t) => {
  const originalUpdate = Team.update;
  t.after(() => {
    Team.update = originalUpdate;
  });

  const calls = [];
  Team.update = async (...args) => {
    calls.push(args);
    return [32];
  };

  const routes = express.Router();
  routes.use("/api/teams", require("../../controllers/api/team-routes"));
  const response = await request(
    createApp({
      routes,
      sessionSecret: "test-session-secret",
      adminPassword: "test-admin-password",
    })
  )
    .put("/api/teams/reset-records")
    .send({});

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    message: "All team records reset to 0-0",
  });
  assert.deepEqual(calls[0], [{ team_record: [0, 0] }, { where: {} }]);
});

test("GET /api/users/username/:username reaches the named route", async (t) => {
  const originalFindOne = User.findOne;
  t.after(() => {
    User.findOne = originalFindOne;
  });

  const calls = [];
  User.findOne = async (query) => {
    calls.push(query);
    return { id: 7, username: "alice" };
  };

  const routes = express.Router();
  routes.use("/api/users", require("../../controllers/api/user-routes"));
  const response = await request(
    createApp({
      routes,
      sessionSecret: "test-session-secret",
      adminPassword: "test-admin-password",
    })
  ).get("/api/users/username/alice");

  assert.equal(response.status, 200);
  assert.equal(response.body.username, "alice");
  assert.deepEqual(calls[0].where, { username: "alice" });
});
