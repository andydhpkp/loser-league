const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const { createPublicCalendarRouter, createCalendarStatusRouter } = require("../../server/calendar/calendar-routes");

const feed = { content: "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n", contentHash: "a".repeat(64), lastModified: new Date("2026-08-13T12:00:00Z") };

test("public feed is sessionless, publicly cached, conditional, and query inert", async () => {
  const app = express(); app.use("/calendar", createPublicCalendarRouter({ service: { getFeed: async () => feed }, available: () => true }));
  const response = await request(app).get("/calendar/pick-deadlines.ics?year=1999&round=4").set("Host", "attacker.invalid");
  assert.equal(response.status, 200); assert.match(response.headers["content-type"], /^text\/calendar; charset=utf-8/); assert.equal(response.headers["cache-control"], "public, max-age=300"); assert.equal(response.headers["set-cookie"], undefined); assert.equal(response.text, feed.content);
  const cached = await request(app).get("/calendar/pick-deadlines.ics").set("If-None-Match", `"${feed.contentHash}"`).set("If-Modified-Since", "Thu, 01 Jan 1970 00:00:00 GMT");
  assert.equal(cached.status, 304); assert.equal(cached.text, "");
  assert.equal((await request(app).post("/calendar/pick-deadlines.ics")).status, 404);
});

test("hidden calendar status requires session and effective access and returns canonical links only", async () => {
  const configuration = { ready: true, feedUrl: "https://example.invalid/calendar/pick-deadlines.ics" };
  const build = (loggedIn, effective) => { const app = express(); app.use((req, _res, next) => { req.session = loggedIn ? { loggedIn: true, user_id: 7 } : {}; next(); }); app.use(createCalendarStatusRouter({ getAccess: async () => ({ effective }), featureConfiguration: { pickRemindersSystemAvailable: true, pickRemindersCalendarAvailable: true }, calendarConfiguration: configuration })); return app; };
  assert.equal((await request(build(false, true)).get("/")).status, 401);
  assert.equal((await request(build(true, false)).get("/")).status, 404);
  const response = await request(build(true, true)).get("/");
  assert.equal(response.headers["cache-control"], "private, no-store");
  assert.deepEqual(response.body, { state: "AVAILABLE", subscriptionUrl: configuration.feedUrl, webcalUrl: configuration.feedUrl.replace("https:", "webcal:"), subscriptionState: "LINK_PROVIDED", subscriptionCompletionDetectable: false });
});
