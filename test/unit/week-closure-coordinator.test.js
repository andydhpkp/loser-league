const assert = require("node:assert/strict");
const test = require("node:test");

const { createWeekClosureCoordinator } = require("../../server/modules/week-closure/week-closure-coordinator");

test("week closure coordinator runs startup catch-up and schedules the evaluator's targeted wake-up", async () => {
  const evaluations = [];
  const timeouts = [];
  const intervals = [];
  const nextCheckAt = new Date("2026-09-13T19:45:00.000Z");
  const coordinator = createWeekClosureCoordinator({
    evaluate: async () => { evaluations.push("evaluate"); return { status: "NOT_DUE", nextCheckAt }; },
    now: () => new Date("2026-09-13T18:00:00.000Z"),
    setTimeoutFn: (callback, milliseconds) => { timeouts.push({ callback, milliseconds }); return 1; },
    clearTimeoutFn() {},
    setIntervalFn: (callback, milliseconds) => { intervals.push({ callback, milliseconds }); return 2; },
    clearIntervalFn() {},
    logger: { info() {}, warn() {} },
  });

  coordinator.start();
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(evaluations, ["evaluate"]);
  assert.equal(timeouts[0].milliseconds, 105 * 60 * 1000);
  assert.equal(intervals[0].milliseconds, 5 * 60 * 1000);
  coordinator.stop();
});

test("week closure coordinator reports one sanitized blocked reason and recovers", async () => {
  const warnings = [];
  const errors = [];
  let attempts = 0;
  const coordinator = createWeekClosureCoordinator({
    evaluate: async () => { attempts += 1; if (attempts < 3) throw Object.assign(new Error("private upstream detail"), { code: "UPSTREAM_ERROR" }); return { status: "PENDING", nextCheckAt: null }; },
    setIntervalFn: () => 1,
    clearIntervalFn() {},
    setTimeoutFn: () => 2,
    clearTimeoutFn() {},
    logger: { info() {}, warn: (event, context) => warnings.push({ event, context }) },
    onError: (error) => errors.push(error.code),
  });

  assert.equal((await coordinator.evaluate()).status, "BLOCKED");
  assert.equal((await coordinator.evaluate()).status, "BLOCKED");
  assert.equal((await coordinator.evaluate()).status, "PENDING");
  assert.deepEqual(warnings, [{ event: "week_closure_blocked", context: { reason: "UPSTREAM_ERROR" } }]);
  assert.deepEqual(errors, ["UPSTREAM_ERROR", "UPSTREAM_ERROR"]);
});

test("week closure coordinator logs one sanitized completion summary", async () => {
  const messages = [];
  const coordinator = createWeekClosureCoordinator({
    evaluate: async () => ({ status: "COMPLETED", week: 4, eliminatedCount: 2, nextCheckAt: null }),
    setIntervalFn: () => 1, clearIntervalFn() {}, setTimeoutFn: () => 2, clearTimeoutFn() {},
    logger: { info: (event, context) => messages.push({ event, context }), warn() {} },
  });
  await coordinator.evaluate();
  assert.deepEqual(messages, [{ event: "week_closure_completed", context: { week: 4, eliminatedCount: 2 } }]);
});

test("week closure coordinator bounds a distant check to Node's maximum timer delay", async () => {
  const timeouts = [];
  const coordinator = createWeekClosureCoordinator({
    evaluate: async () => ({ status: "NOT_DUE", nextCheckAt: new Date("2026-09-10T00:00:00Z") }),
    now: () => new Date("2026-08-02T00:00:00Z"),
    setIntervalFn: () => 1, clearIntervalFn() {},
    setTimeoutFn: (_callback, milliseconds) => { timeouts.push(milliseconds); return 2; }, clearTimeoutFn() {},
    logger: { info() {}, warn() {} },
  });
  await coordinator.evaluate();
  assert.deepEqual(timeouts, [2_147_483_647]);
});
