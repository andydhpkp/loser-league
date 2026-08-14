const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const request = require("supertest");
const { createPushRouter } = require("../../server/user/push-routes");
const { createErrorHandler } = require("../../server/middleware/error-handler");
function app({ authenticated = true, effective = true, available = true, service = {} } = {}) { const application = express(); application.use(express.json({ limit: "8kb" })); application.use((req, _res, next) => { req.session = authenticated ? { loggedIn: true, user_id: 7 } : {}; next(); }); application.use("/api/user/reminders/push", createPushRouter({ service: { status: async () => ({ state: "SETUP_REQUIRED", currentDeviceEnabled: false, deviceCount: 2 }), register: async ({ userId }) => ({ state: "ENABLED_CURRENT_DEVICE", currentDeviceEnabled: true, deviceCount: userId }), disableCurrent: async () => ({ state: "SETUP_REQUIRED", currentDeviceEnabled: false, deviceCount: 1 }), disableAll: async () => ({ state: "USER_DISABLED", currentDeviceEnabled: false, deviceCount: 0 }), ...service }, getAccess: async () => ({ effective }), featureConfiguration: { pickRemindersSystemAvailable: true, pickRemindersPushDeliveryAvailable: available }, pushConfiguration: { ready: available, vapidPublicKey: "safe-public-key" } })); application.use(createErrorHandler({ error() {} })); return application; }
test("push routes authenticate, authorize, and expose only safe configuration/status", async () => {
  assert.equal((await request(app({ authenticated: false })).get("/api/user/reminders/push/configuration")).status, 401);
  assert.equal((await request(app({ effective: false })).get("/api/user/reminders/push/configuration")).status, 404);
  assert.deepEqual((await request(app()).get("/api/user/reminders/push/configuration")).body, { state: "AVAILABLE", publicKey: "safe-public-key" });
  const status = await request(app()).post("/api/user/reminders/push/status").send({ endpoint: "https://push.example.test/x" });
  assert.deepEqual(status.body, { state: "SETUP_REQUIRED", currentDeviceEnabled: false, deviceCount: 2 });
  assert.equal(JSON.stringify(status.body).includes("push.example"), false);
});
test("push writes reject authority fields and disable-all changes only the session User", async () => {
  assert.equal((await request(app()).put("/api/user/reminders/push/subscription").send({ subscription: {}, userId: 9 })).status, 400);
  assert.deepEqual((await request(app()).delete("/api/user/reminders/push/subscriptions").send({})).body, { state: "USER_DISABLED", currentDeviceEnabled: false, deviceCount: 0 });
});
