const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const request = require("supertest");

const { createApp } = require("../../server/app");

function createTestApp(options = {}) {
  return createApp({
    sessionSecret: "test-session-secret",
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

test("invalid onboarding configuration logs setting names only and does not block startup", () => {
  const warnings = [];
  const app = createTestApp({
    logger: { warn: (event, context) => warnings.push({ event, context }), error() {}, info() {}, debug() {} },
    onboardingConfiguration: {
      presentation: { price: "$5", contacts: [], payment: null },
      invalidSettings: ["ONBOARDING_TATE_PHONE"],
    },
  });
  assert.ok(app);
  assert.deepEqual(warnings, [{ event: "onboarding_configuration_invalid", context: { invalidSettings: ["ONBOARDING_TATE_PHONE"] } }]);
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

test("authenticated User pages redirect until a User session exists", async () => {
  const application = createTestApp({ routes: express.Router() });
  for (const path of ["/dashboard.html", "/help.html"]) {
    const response = await request(application).get(path);
    assert.equal(response.status, 302);
    assert.equal(response.headers.location, "/index.html");
  }
});

test("login pages redirect only an authenticated User session", async () => {
  const routes = express.Router();
  routes.post("/authenticate-user", (req, res) => {
    req.session.loggedIn = true;
    req.session.user_id = 42;
    req.session.save(() => res.status(204).end());
  });
  routes.post("/malformed-user", (req, res) => {
    req.session.loggedIn = true;
    req.session.user_id = "42";
    req.session.save(() => res.status(204).end());
  });
  routes.post("/expired-user", (req, res) => {
    req.session.loggedIn = true;
    req.session.user_id = 42;
    req.session.cookie.maxAge = -1;
    req.session.save(() => res.status(204).end());
  });
  const application = createTestApp({ routes });

  for (const path of ["/", "/index.html"]) {
    const anonymous = await request(application).get(path);
    assert.equal(anonymous.status, 200);
    assert.match(anonymous.text, /class="login-form"/);
  }

  const authenticated = request.agent(application);
  await authenticated.post("/authenticate-user").expect(204);
  for (const path of ["/", "/index.html?returnTo=%2Freminder-settings.html"]) {
    const response = await authenticated.get(path);
    assert.equal(response.status, 302);
    assert.equal(response.headers.location, "/dashboard.html");
  }

  const malformed = request.agent(application);
  await malformed.post("/malformed-user").expect(204);
  assert.equal((await malformed.get("/index.html")).status, 200);
  const expired = request.agent(application);
  await expired.post("/expired-user").expect(204);
  assert.equal((await expired.get("/index.html")).status, 200);
  assert.equal((await request(application).get("/index.html").set("Cookie", "connect.sid=invalid")).status, 200);
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

test("admin action registry requires the shared-admin session and exposes no actor", async () => {
  const app = createTestApp({ adminPassword: "test-admin-password" });
  assert.equal((await request(app).get("/api/admin/actions")).status, 401);
  assert.equal((await request(app).post("/api/admin/actions/OVERRIDE_GAME_RESULT/preview").send({})).status, 401);
  assert.equal((await request(app).post("/api/admin/actions/CLOSE_WEEK/preview").send({})).status, 401);

  const agent = request.agent(app);
  await agent.post("/api/admin/login").send({ password: "test-admin-password" });
  const response = await agent.get("/api/admin/actions");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.actions.map((action) => action.name), [
      "CREATE_LEAGUE_SEASON",
      "START_LEAGUE_SEASON",
      "ENABLE_PRESEASON",
      "START_REGULAR_SEASON",
      "ADD_USER_WIN",
    "CREATE_TRACK",
    "DELETE_TRACK",
    "DELETE_USER",
    "SET_PICK_REMINDERS_BETA_ACCESS",
    "SET_PICK_REMINDERS_PUBLIC_RELEASE",
    "SEND_PICK_REMINDERS",
    "OVERRIDE_GAME_RESULT",
    "CLOSE_WEEK",
    "COMPLETE_LEAGUE_SEASON",
    "ROLLOVER_LEAGUE_SEASON",
    "RESET_CURRENT_PICKS",
    "ASSIGN_CURRENT_PICK",
    "REPLACE_CURRENT_PICK",
    "REACTIVATE_TRACK",
    "RESET_PLAYOFF_PICK_POOLS",
    "CORRECT_HISTORICAL_PICK",
    "RECONCILE_PICK_OUTCOME",
    "REBUILD_TRACK_PROJECTIONS",
    "UNDO_ADMIN_ACTION",
  ]);
  assert.equal(JSON.stringify(response.body).includes("actor"), false);
});

test("admin Track inspector authorizes before lookup and returns only its sanitized service view", async () => {
  const lookedUp = [];
  const app = createTestApp({
    routes: express.Router(),
    inspectAdminTrack: async (trackId) => {
      lookedUp.push(trackId);
      return { user: { displayName: "Safe Name", username: "safe" }, track: { id: trackId } };
    },
  });
  assert.equal((await request(app).get("/api/admin/repairs/tracks/42")).status, 401);
  assert.deepEqual(lookedUp, []);

  const agent = request.agent(app);
  await agent.post("/api/admin/login").send({ password: "test-admin-password" });
  const response = await agent.get("/api/admin/repairs/tracks/42");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { user: { displayName: "Safe Name", username: "safe" }, track: { id: 42 } });
  assert.deepEqual(lookedUp, [42]);
});

test("NFL proxy returns upstream JSON through the application interface", async () => {
  const upstreamBody = [{ id: 1, home: "Denver Broncos" }];
  const app = createTestApp({
    routes: express.Router(),
    sessionSecret: "test-session-secret",
    loadLeagueSeasonYear: async () => 2026,
    fetchImpl: async () => ({
      ok: true,
      json: async () => upstreamBody,
    }),
  });

  const response = await request(app).get("/api/proxy/nfl");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, upstreamBody);
});

test("active Fixture proxy resolves its year from the stored League Season", async () => {
  let upstreamUrl;
  const app = createTestApp({
    routes: express.Router(),
    loadLeagueSeasonYear: async () => 2027,
    fetchImpl: async (url) => {
      upstreamUrl = url;
      return { ok: true, json: async () => [] };
    },
  });
  assert.equal((await request(app).get("/api/proxy/nfl")).status, 200);
  assert.equal(upstreamUrl, "https://fixturedownload.com/feed/json/nfl-2027");
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

test("NFL Schedule route normalizes approved ESPN scoreboard JSON", async () => {
  const upstreamBody = {
    events: [
      {
        date: "2025-11-21T01:15Z",
        competitions: [{ competitors: [] }],
      },
    ],
  };
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
  assert.deepEqual(response.body, {
    content: {
      schedule: {
        "2025-11-21": { games: upstreamBody.events },
      },
    },
  });
  assert.equal(upstreamUrl.origin, "https://site.api.espn.com");
  assert.equal(
    upstreamUrl.pathname,
    "/apis/site/v2/sports/football/nfl/scoreboard"
  );
  assert.equal(upstreamUrl.searchParams.get("dates"), "2025");
  assert.equal(upstreamUrl.searchParams.get("seasontype"), "3");
  assert.equal(upstreamUrl.searchParams.get("week"), "4");

  const regularSeasonResponse = await request(app).get(
    "/api/nfl/schedule?year=2025&week=12"
  );
  assert.equal(regularSeasonResponse.status, 200);
  assert.equal(upstreamUrl.searchParams.get("seasontype"), "2");
  assert.equal(upstreamUrl.searchParams.get("week"), "12");

  const preseasonResponse = await request(app).get(
    "/api/nfl/schedule?year=2025&week=2&seasonType=preseason"
  );
  assert.equal(preseasonResponse.status, 200);
  assert.equal(upstreamUrl.searchParams.get("seasontype"), "1");
  assert.equal(upstreamUrl.searchParams.get("week"), "2");
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
