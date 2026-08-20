const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createDatabaseCapacityRecovery,
  isDatabaseCapacityError,
  recoverDatabaseProcess,
} = require("../../server/infrastructure/database-capacity-recovery");

function capacityError() {
  const cause = new Error("User has exceeded the 'max_user_connections' resource (current value: 10)");
  cause.name = "SequelizeConnectionError";
  const error = new Error("database unavailable", { cause });
  error.name = "SequelizeConnectionError";
  return error;
}

test("capacity classification is exact and follows safe error causes", () => {
  assert.equal(isDatabaseCapacityError(capacityError()), true);
  assert.equal(isDatabaseCapacityError(new Error("connection refused")), false);
  assert.equal(isDatabaseCapacityError(new Error("pool acquire timeout")), false);
});

test("three capacity failures within sixty seconds trigger one recovery", async () => {
  let currentTime = 0;
  const recoveries = [];
  const recovery = createDatabaseCapacityRecovery({
    now: () => currentTime,
    recover: async () => recoveries.push(currentTime),
    logger: { warn() {}, info() {}, error() {} },
  });

  assert.equal(await recovery.record(capacityError()), false);
  currentTime = 30_000;
  assert.equal(await recovery.record(capacityError()), false);
  currentTime = 59_999;
  assert.equal(await recovery.record(capacityError()), true);
  assert.deepEqual(recoveries, [59_999]);
  assert.equal(await recovery.record(capacityError()), false);

  const reset = createDatabaseCapacityRecovery({
    now: () => currentTime,
    recover: async () => recoveries.push("reset"),
    logger: { warn() {}, info() {}, error() {} },
  });
  await reset.record(capacityError());
  currentTime += 60_001;
  await reset.record(capacityError());
  currentTime += 1;
  assert.equal(await reset.record(capacityError()), false);
  assert.equal(recoveries.includes("reset"), false);
});

test("process recovery stops work, closes resources, and exits once", async () => {
  const calls = [];
  const server = { close: (callback) => { calls.push("server.close"); callback(); } };
  const lifecycleCoordinator = { stop: () => calls.push("lifecycle.stop") };
  const database = { close: async () => calls.push("database.close") };

  await recoverDatabaseProcess({
    server,
    lifecycleCoordinator,
    database,
    exit: (code) => calls.push(["exit", code]),
    logger: { warn: (event) => calls.push(event), info: (event) => calls.push(event), error() {} },
    setTimeoutFn: () => ({ unref() {} }),
    clearTimeoutFn() {},
  });

  assert.deepEqual(calls, [
    "database_capacity_recovery_started",
    "lifecycle.stop",
    "server.close",
    "database.close",
    "database_capacity_recovery_completed",
    ["exit", 1],
  ]);
});

test("process recovery forces exit after the graceful deadline", async () => {
  const calls = [];
  const timer = { unref: () => calls.push("timer.unref") };
  await recoverDatabaseProcess({
    server: {
      close: () => calls.push("server.close"),
      closeAllConnections: () => calls.push("server.closeAllConnections"),
    },
    lifecycleCoordinator: { stop: () => calls.push("lifecycle.stop") },
    database: { close: async () => calls.push("database.close") },
    exit: (code) => calls.push(["exit", code]),
    logger: { warn: (event) => calls.push(event), info() {}, error: (event) => calls.push(event) },
    setTimeoutFn: (callback) => { queueMicrotask(callback); return timer; },
    clearTimeoutFn() {},
  });

  assert.ok(calls.includes("database_capacity_recovery_deadline_exceeded"));
  assert.ok(calls.includes("server.closeAllConnections"));
  assert.deepEqual(calls.at(-1), ["exit", 1]);
});
