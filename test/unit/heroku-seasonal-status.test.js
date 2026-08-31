const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildStatus,
  latestRelease,
  parseArguments,
  summarizeAddons,
  summarizeFormation,
} = require("../../scripts/heroku-seasonal-status");

test("Heroku seasonal status argument parser requires an exact app", () => {
  assert.deepEqual(parseArguments(["--app", "loser-league"]), {
    app: "loser-league",
    origin: null,
  });
  assert.deepEqual(parseArguments(["--app", "loser-league", "--origin", "https://example.test"]), {
    app: "loser-league",
    origin: "https://example.test",
  });
  assert.throws(() => parseArguments([]), /--app is required/);
  assert.throws(() => parseArguments(["--config"]), /Unknown argument/);
  assert.throws(() => parseArguments(["--app", "../loser-league"]), /exact Heroku app name/);
});

test("Heroku seasonal status summarizes formation, add-ons, and release identity", () => {
  assert.deepEqual(
    summarizeFormation([
      { type: "web", quantity: 0, size: { name: "Basic" } },
      { type: "release", quantity: 1, size: "Eco" },
    ]),
    [
      { type: "release", dynos: 1, size: "Eco" },
      { type: "web", dynos: 0, size: "Basic" },
    ]
  );
  assert.deepEqual(
    summarizeAddons([
      { name: "papertrail-a", addon_service: { name: "papertrail" }, plan: { name: "papertrail:choklad" }, state: "created" },
      { name: "jawsdb-b", plan: { name: "jawsdb:kitefin" }, state: "created" },
    ]),
    [
      { name: "jawsdb-b", service: null, plan: "jawsdb:kitefin", state: "created" },
      { name: "papertrail-a", service: "papertrail", plan: "papertrail:choklad", state: "created" },
    ]
  );
  assert.deepEqual(
    latestRelease([{ version: 42, status: "succeeded", description: "Deploy abc123", created_at: "2026-08-31T00:00:00Z" }]),
    {
      version: 42,
      status: "succeeded",
      description: "Deploy abc123",
      createdAt: "2026-08-31T00:00:00Z",
    }
  );
});

test("Heroku seasonal status does not call config-var commands", async () => {
  const calls = [];
  const payloads = {
    "heroku api /apps/loser-league/formation": JSON.stringify([{ type: "web", quantity: 0, size: { name: "Basic" } }]),
    "heroku addons --json --app loser-league": JSON.stringify([{ name: "jawsdb", plan: { name: "jawsdb:kitefin" } }]),
    "heroku releases --json --app loser-league": JSON.stringify([{ version: 12, status: "succeeded", description: "Deploy abc", created_at: "2026-08-31T00:00:00Z" }]),
    "git ls-remote heroku refs/heads/main": "abc\trefs/heads/main\n",
  };
  const spawn = (command, args) => {
    const key = [command, ...args].join(" ");
    calls.push(key);
    return { status: 0, stdout: payloads[key] };
  };

  const status = await buildStatus({
    app: "loser-league",
    origin: null,
    spawn,
  });

  assert.equal(status.configValuesRead, false);
  assert.equal(calls.some((call) => call.includes("config")), false);
  assert.deepEqual(status.formation, [{ type: "web", dynos: 0, size: "Basic" }]);
  assert.equal(status.health.configured, false);
});
