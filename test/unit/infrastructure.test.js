const assert = require("node:assert/strict");
const { test } = require("node:test");
const express = require("express");
const request = require("supertest");

const {
  AppError,
  AuthenticationError,
  ConflictError,
  NotFoundError,
  UpstreamError,
  ValidationError,
} = require("../../server/lib/errors");
const { createLogger, redact } = require("../../server/lib/logger");
const { createApp } = require("../../server/app");
const { startServer } = require("../../server/start");

function createTestApp(options = {}) {
  return createApp({
    adminPassword: "test-admin-password",
    ...options,
  });
}

test("web startup verifies the database without synchronizing schema", async () => {
  const calls = [];
  const database = {
    authenticate: async () => calls.push("authenticate"),
    sync: async () => calls.push("sync"),
  };
  const app = {
    listen(port, callback) {
      calls.push(["listen", port]);
      callback();
      return { close() {} };
    },
  };
  const logger = { info() {}, error() {} };

  await startServer({ app, database, port: 4321, logger });

  assert.deepEqual(calls, ["authenticate", ["listen", 4321]]);
});

test("application requires a session secret", () => {
  assert.throws(
    () => createApp({ routes: express.Router(), sessionSecret: "" }),
    /SESSION_SECRET is required/
  );
});

test("request context preserves a supplied request ID", async () => {
  const routes = express.Router();
  routes.get("/request-id", (req, res) => res.json({ id: req.requestId }));

  const response = await request(
    createTestApp({ routes, sessionSecret: "test-secret" })
  )
    .get("/request-id")
    .set("x-request-id", "caller-id");

  assert.equal(response.status, 200);
  assert.equal(response.body.id, "caller-id");
  assert.equal(response.headers["x-request-id"], "caller-id");
});

test("application errors retain stable codes, statuses, messages, and causes", () => {
  const cause = new Error("upstream");
  const errors = [
    [new ValidationError("bad input"), "VALIDATION_ERROR", 400],
    [new AuthenticationError(), "AUTHENTICATION_ERROR", 401],
    [new NotFoundError("missing"), "NOT_FOUND", 404],
    [new ConflictError("duplicate"), "CONFLICT", 409],
    [new UpstreamError(undefined, cause), "UPSTREAM_ERROR", 502],
  ];

  for (const [error, code, status] of errors) {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
  }
  assert.equal(errors[4][0].cause, cause);
});

test("expected application errors use their public contract", async () => {
  const routes = express.Router();
  routes.get("/expected", (_req, _res, next) =>
    next(new ConflictError("Already exists"))
  );
  const entries = [];
  const response = await request(
    createTestApp({
      routes,
      sessionSecret: "test-secret",
      logger: {
        error: (event, context) => entries.push({ event, context }),
        warn() {},
        info() {},
        debug() {},
      },
    })
  ).get("/expected");

  assert.equal(response.status, 409);
  assert.deepEqual(response.body, {
    error: "CONFLICT",
    message: "Already exists",
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].context.status, 409);
});

test("schedule proxy maps rejected and thrown upstream calls to safe 502 errors", async () => {
  for (const fetchImpl of [
    async () => ({ ok: false }),
    async () => {
      throw new Error("secret upstream detail");
    },
  ]) {
    const response = await request(
      createTestApp({
        routes: express.Router(),
        sessionSecret: "test-secret",
        fetchImpl,
      })
    ).get("/api/proxy/nfl-2025");

    assert.equal(response.status, 502);
    assert.deepEqual(response.body, {
      error: "UPSTREAM_ERROR",
      message: "NFL schedule data is unavailable",
    });
  }
});

test("odds proxy handles missing configuration and upstream rejection", async () => {
  const missing = await request(
    createTestApp({
      routes: express.Router(),
      sessionSecret: "test-secret",
      oddsApiKey: "",
    })
  ).get("/api/proxy/nfl-odds");
  assert.equal(missing.status, 502);
  assert.equal(missing.body.message, "NFL odds configuration is unavailable");

  const rejected = await request(
    createTestApp({
      routes: express.Router(),
      sessionSecret: "test-secret",
      oddsApiKey: "key",
      fetchImpl: async () => ({ ok: false }),
    })
  ).get("/api/proxy/nfl-odds");
  assert.equal(rejected.status, 502);
  assert.equal(rejected.body.message, "NFL odds data is unavailable");
});

test("redact recursively removes sensitive object and array values", () => {
  const input = {
    username: "alice",
    password: "secret",
    nested: {
      sessionToken: "token",
      items: [{ authorization: "bearer" }, { safe: "value" }],
    },
  };

  assert.deepEqual(redact(input), {
    username: "alice",
    password: "[REDACTED]",
    nested: {
      sessionToken: "[REDACTED]",
      items: [{ authorization: "[REDACTED]" }, { safe: "value" }],
    },
  });
  assert.equal(redact(null), null);
  assert.equal(redact("plain"), "plain");
});

test("logger filters levels, redacts context, and falls back to log output", () => {
  const calls = [];
  const output = {
    log: (entry) => calls.push(["log", JSON.parse(entry)]),
    warn: (entry) => calls.push(["warn", JSON.parse(entry)]),
    error: (entry) => calls.push(["error", JSON.parse(entry)]),
  };
  const logger = createLogger({ level: "warn", output });

  logger.debug("hidden");
  logger.info("hidden");
  logger.warn("warning", { password: "secret" });
  logger.error("failure", { value: 7 });

  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], "warn");
  assert.equal(calls[0][1].password, "[REDACTED]");
  assert.equal(calls[1][1].event, "failure");
  assert.match(calls[1][1].timestamp, /^\d{4}-\d{2}-\d{2}T/);

  const fallback = createLogger({ level: "unknown", output });
  fallback.info("fallback");
  assert.equal(calls.at(-1)[0], "log");
});
