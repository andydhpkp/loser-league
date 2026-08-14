const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const request = require("supertest");

const { createReminderSettingsPageRouter } = require("../../server/user/reminder-settings-routes");

function app({ loggedIn = true, effective = true } = {}) {
  const application = express();
  application.use((req, _res, next) => {
    req.session = loggedIn ? { loggedIn: true, user_id: 17 } : {};
    next();
  });
  application.use(createReminderSettingsPageRouter({
    getAccess: async ({ userId, systemAvailable }) => ({ effective: effective && userId === 17 && systemAvailable }),
    featureConfiguration: { pickRemindersSystemAvailable: true },
    pagePath: require("node:path").join(__dirname, "../../public/reminder-settings.html"),
  }));
  return application;
}

test("settings page redirects unauthenticated Users and fails closed without access", async () => {
  assert.equal((await request(app({ loggedIn: false })).get("/reminder-settings.html")).headers.location, "/index.html?returnTo=%2Freminder-settings.html");
  const unavailable = await request(app({ effective: false })).get("/reminder-settings.html");
  assert.equal(unavailable.status, 404);
  assert.equal(unavailable.headers["cache-control"], "private, no-store");
  assert.doesNotMatch(unavailable.text, /Push notifications/);
});

test("settings page is private and available only with effective access", async () => {
  const response = await request(app()).get("/reminder-settings.html");
  assert.equal(response.status, 200);
  assert.equal(response.headers["cache-control"], "private, no-store");
  assert.match(response.text, /Pick Reminder Settings/);
});
