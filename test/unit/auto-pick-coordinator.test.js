const assert = require("node:assert/strict");
const test = require("node:test");

const { createAutoPickCoordinator } = require("../../server/modules/picks/auto-pick-coordinator");

test("coordinator starts catch-up, schedules the deadline, and recovers every 30 seconds", async () => {
  const evaluations = [];
  const intervals = [];
  const timeouts = [];
  const deadline = new Date("2026-09-10T00:01:00Z");
  const coordinator = createAutoPickCoordinator({
    evaluate: async () => { evaluations.push("evaluate"); return { status: "NOT_DUE", deadline }; },
    now: () => new Date("2026-09-10T00:00:00Z"),
    setIntervalFn: (callback, milliseconds) => { intervals.push({ callback, milliseconds }); return 1; },
    clearIntervalFn() {},
    setTimeoutFn: (callback, milliseconds) => { timeouts.push({ callback, milliseconds }); return 2; },
    clearTimeoutFn() {},
    logger: { info() {}, warn() {}, error() {} },
  });

  coordinator.start();
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(evaluations, ["evaluate"]);
  assert.equal(intervals[0].milliseconds, 30_000);
  assert.equal(timeouts[0].milliseconds, 60_000);
  coordinator.stop();
});

test("coordinator bounds a distant deadline to Node's maximum timer delay", async () => {
  const timeouts = [];
  const coordinator = createAutoPickCoordinator({
    evaluate: async () => ({ status: "NOT_DUE", deadline: new Date("2026-09-10T00:00:00Z") }),
    now: () => new Date("2026-08-02T00:00:00Z"),
    setIntervalFn: () => 1, clearIntervalFn() {},
    setTimeoutFn: (_callback, milliseconds) => { timeouts.push(milliseconds); return 2; }, clearTimeoutFn() {},
    logger: { info() {}, warn() {} },
  });
  await coordinator.evaluate();
  assert.deepEqual(timeouts, [2_147_483_647]);
});

test("coordinator reports blocked database work to infrastructure recovery", async () => {
  const failures = [];
  const error = new Error("capacity");
  const coordinator = createAutoPickCoordinator({
    evaluate: async () => { throw error; },
    setIntervalFn: () => 1, clearIntervalFn() {}, setTimeoutFn: () => 2, clearTimeoutFn() {},
    logger: { info() {}, warn() {} },
    onError: (observed) => failures.push(observed),
  });
  assert.equal((await coordinator.evaluate()).status, "BLOCKED");
  assert.deepEqual(failures, [error]);
});
