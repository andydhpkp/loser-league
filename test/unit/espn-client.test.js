const assert = require("node:assert/strict");
const test = require("node:test");

const { UpstreamError } = require("../../server/lib/errors");
const { createEspnClient } = require("../../server/nfl/espn-client");

test("ESPN client converts timeout to a safe upstream error", async () => {
  const keepEventLoopAlive = setTimeout(() => {}, 50);
  const client = createEspnClient({
    timeoutMs: 1,
    fetchImpl: async (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason));
      }),
  });

  try {
    await assert.rejects(
      client.fetchTeams(),
      (error) =>
        error instanceof UpstreamError &&
        error.message === "NFL data is unavailable" &&
        error.upstreamFailure === "UPSTREAM_TIMEOUT"
    );
  } finally {
    clearTimeout(keepEventLoopAlive);
  }
});

test("ESPN client classifies safe upstream diagnostics without raw failure details", async () => {
  const failures = [
    [async () => ({ ok: false, status: 429 }), "UPSTREAM_HTTP_STATUS", 429],
    [async () => { const error = new Error("private DNS detail"); error.code = "ENOTFOUND"; throw error; }, "UPSTREAM_DNS"],
    [async () => { const error = new Error("private TLS detail"); error.code = "CERT_HAS_EXPIRED"; throw error; }, "UPSTREAM_TLS"],
    [async () => { const error = new Error("private connection detail"); error.code = "ECONNRESET"; throw error; }, "UPSTREAM_CONNECTION"],
    [async () => { throw new Error("private unknown detail"); }, "UPSTREAM_UNKNOWN"],
  ];

  for (const [fetchImpl, expectedFailure, expectedStatus] of failures) {
    const client = createEspnClient({ fetchImpl });
    await assert.rejects(client.fetchTeams(), (error) => {
      assert.equal(error.upstreamFailure, expectedFailure);
      assert.equal(error.upstreamStatus, expectedStatus);
      assert.doesNotMatch(JSON.stringify(error), /private|ENOTFOUND|CERT_HAS_EXPIRED|ECONNRESET/);
      return true;
    });
  }
});

test("ESPN client converts rejection and malformed JSON to safe errors", async () => {
  const failures = [
    async () => ({ ok: false, status: 503 }),
    async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError("upstream body detail");
      },
    }),
    async () => {
      throw new Error("network detail");
    },
  ];

  for (const fetchImpl of failures) {
    const client = createEspnClient({ fetchImpl, timeoutMs: 1 });

    await assert.rejects(
      client.fetchTeams(),
      (error) =>
        error instanceof UpstreamError &&
        error.message === "NFL data is unavailable"
    );
  }
});

test("ESPN client applies the configured timeout signal to upstream requests", async () => {
  let receivedSignal;
  const client = createEspnClient({
    timeoutMs: 50,
    fetchImpl: async (_url, options) => {
      receivedSignal = options.signal;
      return { ok: true, json: async () => ({}) };
    },
  });

  await client.fetchTeams();

  assert.ok(receivedSignal instanceof AbortSignal);
});
