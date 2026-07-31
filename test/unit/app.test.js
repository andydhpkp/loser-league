const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const request = require("supertest");

const { createApp } = require("../../server/app");

function createTestApp(options = {}) {
  return createApp({
    adminPassword: "test-admin-password",
    ...options,
  });
}

test("application requires an admin password", () => {
  assert.throws(
    () =>
      createApp({
        routes: express.Router(),
        sessionSecret: "test-session-secret",
        adminPassword: "",
      }),
    /ADMIN_PASSWORD is required/
  );
});

test("admin login creates a server-owned session only for the configured password", async () => {
  const agent = request.agent(
    createTestApp({
      routes: express.Router(),
      sessionSecret: "test-session-secret",
      adminPassword: "test-admin-password",
    })
  );

  assert.deepEqual((await agent.get("/api/admin/session")).body, {
    authenticated: false,
  });

  const rejected = await agent
    .post("/api/admin/login")
    .send({ password: "incorrect" });
  assert.equal(rejected.status, 401);
  assert.deepEqual(rejected.body, {
    error: "UNAUTHORIZED",
    message: "Incorrect admin password",
  });
  assert.deepEqual((await agent.get("/api/admin/session")).body, {
    authenticated: false,
  });

  const loginStartedAt = Date.now();
  const accepted = await agent
    .post("/api/admin/login")
    .send({ password: "test-admin-password" });
  assert.equal(accepted.status, 204);
  const expiresMatch = accepted.headers["set-cookie"][0].match(
    /Expires=([^;]+)/
  );
  assert.ok(expiresMatch);
  const expiresAt = Date.parse(expiresMatch[1]);
  assert.ok(expiresAt >= loginStartedAt + 8 * 60 * 60 * 1000 - 1000);
  assert.ok(expiresAt <= loginStartedAt + 8 * 60 * 60 * 1000 + 1000);
  assert.deepEqual((await agent.get("/api/admin/session")).body, {
    authenticated: true,
  });

  assert.equal((await agent.post("/api/admin/logout")).status, 204);
  assert.deepEqual((await agent.get("/api/admin/session")).body, {
    authenticated: false,
  });
});

test("admin page redirects until the client has an admin session", async () => {
  const agent = request.agent(
    createTestApp({
      routes: express.Router(),
      sessionSecret: "test-session-secret",
      adminPassword: "test-admin-password",
    })
  );

  const rejected = await agent.get("/admin.html");
  assert.equal(rejected.status, 302);
  assert.equal(rejected.headers.location, "/index.html");

  await agent
    .post("/api/admin/login")
    .send({ password: "test-admin-password" })
    .expect(204);
  const accepted = await agent.get("/admin.html");
  assert.equal(accepted.status, 200);
  assert.match(accepted.text, /id="adminView"/);
});

test("admin login rejects malformed credentials with one generic response", async () => {
  const app = createTestApp({
    routes: express.Router(),
    sessionSecret: "test-session-secret",
  });

  for (const password of [undefined, "", null, 42]) {
    const response = await request(app)
      .post("/api/admin/login")
      .send(password === undefined ? {} : { password });
    assert.equal(response.status, 401);
    assert.deepEqual(response.body, {
      error: "UNAUTHORIZED",
      message: "Incorrect admin password",
    });
  }
});

test("NFL proxy returns upstream JSON through the application interface", async () => {
  const upstreamBody = [{ id: 1, home: "Denver Broncos" }];
  const app = createTestApp({
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

test("NFL Teams route passes through the approved ESPN response", async () => {
  const upstreamBody = { sports: [{ leagues: [{ teams: [] }] }] };
  let upstreamUrl;
  const app = createTestApp({
    routes: express.Router(),
    sessionSecret: "test-session-secret",
    fetchImpl: async (url) => {
      upstreamUrl = new URL(url);
      return {
        ok: true,
        json: async () => upstreamBody,
      };
    },
  });

  const response = await request(app).get("/api/nfl/teams");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, upstreamBody);
  assert.equal(upstreamUrl.origin, "https://site.api.espn.com");
  assert.equal(
    upstreamUrl.pathname,
    "/apis/site/v2/sports/football/nfl/teams"
  );
  assert.equal(upstreamUrl.search, "");
});

test("NFL Schedule route validates inputs and passes through approved ESPN JSON", async () => {
  const upstreamBody = { content: { schedule: {} } };
  let upstreamUrl;
  const app = createTestApp({
    routes: express.Router(),
    sessionSecret: "test-session-secret",
    fetchImpl: async (url) => {
      upstreamUrl = new URL(url);
      return {
        ok: true,
        json: async () => upstreamBody,
      };
    },
  });

  const response = await request(app).get(
    "/api/nfl/schedule?year=2025&week=22"
  );

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, upstreamBody);
  assert.equal(upstreamUrl.origin, "https://cdn.espn.com");
  assert.equal(upstreamUrl.pathname, "/core/nfl/schedule");
  assert.equal(upstreamUrl.searchParams.get("xhr"), "1");
  assert.equal(upstreamUrl.searchParams.get("year"), "2025");
  assert.equal(upstreamUrl.searchParams.get("week"), "22");
});

test("NFL Schedule route rejects unsafe or unsupported query values", async () => {
  const currentYear = new Date().getUTCFullYear();
  const invalidQueries = [
    "",
    "?year=2025",
    "?week=1",
    "?year=1999&week=1",
    `?year=${currentYear + 2}&week=1`,
    "?year=2025&week=0",
    "?year=2025&week=23",
    "?year=2025.0&week=1",
    "?year=+2025&week=1",
    "?year=2025x&week=1",
    "?year=2025&week=01",
    "?year=2025&year=2026&week=1",
    "?year=2025&week=1&week=2",
  ];
  let fetchCalls = 0;
  const app = createTestApp({
    routes: express.Router(),
    sessionSecret: "test-session-secret",
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error("fetch must not be called");
    },
  });

  for (const query of invalidQueries) {
    const response = await request(app).get(`/api/nfl/schedule${query}`);
    assert.equal(response.status, 400, query);
    assert.deepEqual(response.body, {
      error: "VALIDATION_ERROR",
      message: "A valid NFL season year and week are required",
    });
  }
  assert.equal(fetchCalls, 0);
});

test("NFL odds proxy keeps the API credential behind the server interface", async () => {
  const upstreamBody = [{ id: "game-1", bookmakers: [] }];
  let upstreamUrl;
  const app = createTestApp({
    routes: express.Router(),
    sessionSecret: "test-session-secret",
    oddsApiKey: "test-odds-api-key",
    fetchImpl: async (url) => {
      upstreamUrl = new URL(url);
      return {
        ok: true,
        json: async () => upstreamBody,
      };
    },
  });

  const response = await request(app).get("/api/proxy/nfl-odds");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, upstreamBody);
  assert.equal(upstreamUrl.hostname, "api.the-odds-api.com");
  assert.equal(upstreamUrl.searchParams.get("apiKey"), "test-odds-api-key");
  assert.equal(upstreamUrl.searchParams.get("regions"), "us");
  assert.equal(upstreamUrl.searchParams.get("markets"), "spreads");
  assert.equal(upstreamUrl.searchParams.get("bookmakers"), "draftkings");
});

test("unexpected route failures use one safe error interface", async () => {
  const routes = express.Router();
  const entries = [];
  routes.get("/explode", () => {
    throw new Error("database password leaked");
  });

  const app = createTestApp({
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
