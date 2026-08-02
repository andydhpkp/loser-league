const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const session = require("express-session");
const request = require("supertest");

const { createDashboardRouter } = require("../../server/user/dashboard-routes");

function app(service) {
  const application = express();
  application.use(session({ secret: "dashboard-route-test", resave: false, saveUninitialized: true }));
  application.post("/login", (req, res) => { req.session.loggedIn = true; req.session.user_id = 42; res.sendStatus(204); });
  application.use("/api/user/dashboard", createDashboardRouter(service));
  return application;
}

test("dashboard route authorizes before loading and returns private summary", async () => {
  const calls = [];
  const application = app({ getSummary: async (input) => { calls.push(input); return { safe: true }; } });
  assert.equal((await request(application).get("/api/user/dashboard")).status, 401);
  assert.deepEqual(calls, []);
  const agent = request.agent(application);
  await agent.post("/login");
  const response = await agent.get("/api/user/dashboard");
  assert.equal(response.status, 200);
  assert.equal(response.headers["cache-control"], "private, no-store");
  assert.deepEqual(response.body, { safe: true });
  assert.deepEqual(calls, [{ userId: 42 }]);
});
