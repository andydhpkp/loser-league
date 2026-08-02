const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const request = require("supertest");
const { createAdminBuybackRouter } = require("../../server/admin/buyback-routes");

function appFor({ authenticated, service }) {
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.session = authenticated ? { adminAuthenticated: true } : {}; next(); });
  app.use("/api/admin/buybacks", createAdminBuybackRouter(service));
  return app;
}

test("admin buyback routes authorize before service lookup", async () => {
  let called = false;
  const service = { listAdmin: async () => { called = true; } };
  assert.equal((await request(appFor({ authenticated: false, service })).get("/api/admin/buybacks")).status, 401);
  assert.equal(called, false);
});

test("admin buyback routes map queue, subset completion, cancellation, and direct completion", async () => {
  const calls = [];
  const service = {
    listAdmin: async (input) => { calls.push(["list", input]); return []; },
    resolveAdmin: async (input) => { calls.push(["resolve", input]); return { status: "COMPLETED_USER_REQUEST" }; },
    completeAdminDirect: async (input) => { calls.push(["direct", input]); return { status: "COMPLETED_ADMIN_DIRECT" }; },
  };
  const app = appFor({ authenticated: true, service });
  assert.equal((await request(app).get("/api/admin/buybacks?view=history")).status, 200);
  assert.equal((await request(app).post("/api/admin/buybacks/3/complete").send({ stateVersion: 1, fulfilledTrackIds: [9], paymentConfirmed: true })).status, 200);
  assert.equal((await request(app).post("/api/admin/buybacks/3/cancel").send({ stateVersion: 2 })).status, 200);
  assert.equal((await request(app).post("/api/admin/buybacks/direct/complete").send({ userId: 4, trackIds: [9], stateVersion: 0, paymentConfirmed: true })).status, 200);
  assert.equal(calls[0][1].view, "history");
  assert.deepEqual(calls[1][1].fulfilledTrackIds, [9]);
  assert.equal(calls[2][1].cancel, true);
  assert.equal(calls[3][1].userId, 4);
});
