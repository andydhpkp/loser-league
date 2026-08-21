const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const test = require("node:test");
const {
  SUMMARY_INTERVAL_MS,
  classifyRequest,
  createRequestVolumeMiddleware,
} = require("../../server/middleware/request-volume");

function response(statusCode) {
  const res = new EventEmitter();
  res.statusCode = statusCode;
  return res;
}

test("request volume classification exposes only coarse operational categories", () => {
  assert.equal(classifyRequest({ method: "GET", path: "/styles/main.css" }), "static");
  assert.equal(classifyRequest({ method: "GET", path: "/" }), "health");
  assert.equal(classifyRequest({ method: "GET", path: "/api/nfl/teams" }), "health");
  assert.equal(classifyRequest({ method: "POST", path: "/api/user/league/picks" }), "api");
  assert.equal(classifyRequest({ method: "GET", path: "/dashboard.html" }), "page");
  assert.equal(classifyRequest({ method: "GET", path: "/unknown" }), "other");
});

test("request volume emits one bounded hourly summary without request details", () => {
  let currentTime = new Date("2026-08-21T00:00:00.000Z");
  const events = [];
  const middleware = createRequestVolumeMiddleware({
    logger: { info: (event, context) => events.push({ event, context }) },
    now: () => currentTime,
  });

  const first = response(200);
  middleware({ method: "GET", path: "/styles/main.css" }, first, () => {});
  first.emit("finish");

  currentTime = new Date(currentTime.getTime() + 10_000);
  const second = response(503);
  middleware({ method: "GET", path: "/api/nfl/teams" }, second, () => {});
  second.emit("finish");
  assert.deepEqual(events, []);

  currentTime = new Date(currentTime.getTime() + SUMMARY_INTERVAL_MS);
  const third = response(404);
  middleware({ method: "GET", path: "/scanner?token=secret" }, third, () => {});
  third.emit("finish");

  assert.deepEqual(events, [{
    event: "request_volume_completed",
    context: {
      intervalSeconds: 3600,
      total: 2,
      categories: { static: 1, health: 1, api: 0, page: 0, other: 0 },
      statuses: { informational: 0, successful: 1, redirection: 0, clientError: 0, serverError: 1, unknown: 0 },
    },
  }]);
  assert.equal(JSON.stringify(events).includes("secret"), false);
});
