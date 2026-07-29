const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const request = require("supertest");

const { createApp } = require("../../server/app");

test("NFL proxy returns upstream JSON through the application interface", async () => {
  const upstreamBody = [{ id: 1, home: "Denver Broncos" }];
  const app = createApp({
    routes: express.Router(),
    sessionSecret: "test-session-secret",
    fetchImpl: async () => ({
      ok: true,
      json: async () => upstreamBody,
    }),
  });

  const response = await request(app).get("/api/proxy/nfl-2025");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, upstreamBody);
});

test("unexpected route failures use one safe error interface", async () => {
  const routes = express.Router();
  const entries = [];
  routes.get("/explode", () => {
    throw new Error("database password leaked");
  });

  const app = createApp({
    routes,
    sessionSecret: "test-session-secret",
    logger: {
      error(event, context) {
        entries.push({ event, context });
      },
      warn() {},
      info() {},
      debug() {},
    },
  });

  const response = await request(app).get("/explode");

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    error: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
  });
  assert.match(response.headers["x-request-id"], /^[0-9a-f-]{36}$/);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].context.method, "GET");
  assert.equal(entries[0].context.route, "/explode");
  assert.equal(entries[0].context.errorCode, "INTERNAL_ERROR");
  assert.doesNotMatch(JSON.stringify(entries[0]), /database password leaked/);
});
