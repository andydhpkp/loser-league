const assert = require("node:assert/strict");
const test = require("node:test");
const { createReminderCoordinator } = require("../../server/modules/reminders/reminder-coordinator");

test("reminder coordinator performs startup catch-up, exact wakeup, periodic recovery, delivery, cleanup, and clean shutdown", async () => {
  const calls = [];
  const timers = [];
  const intervals = [];
  const coordinator = createReminderCoordinator({
    evaluate: async () => { calls.push("evaluate"); return { status: "NOT_DUE", nextCheckAt: new Date("2026-09-10T00:01:00Z") }; },
    processDue: async () => { calls.push("process"); return {}; }, cleanup: async () => { calls.push("cleanup"); return {}; },
    now: () => new Date("2026-09-10T00:00:00Z"),
    setTimeoutFn: (callback, milliseconds) => { timers.push({ callback, milliseconds }); return 1; }, clearTimeoutFn: (id) => calls.push(`clear-timeout-${id}`),
    setIntervalFn: (callback, milliseconds) => { intervals.push({ callback, milliseconds }); return intervals.length + 1; }, clearIntervalFn: (id) => calls.push(`clear-interval-${id}`),
    logger: { info() {}, warn() {} },
  });
  coordinator.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(new Set(calls.slice(0, 3)), new Set(["evaluate", "process", "cleanup"]));
  assert.equal(timers[0].milliseconds, 60_000);
  assert.deepEqual(intervals.map(({ milliseconds }) => milliseconds), [30_000, 86_400_000]);
  await intervals[0].callback();
  assert.equal(calls.filter((item) => item === "evaluate").length, 2);
  coordinator.stop();
  assert.ok(calls.includes("clear-timeout-1"));
});

test("reminder coordinator reports evaluation and cleanup failures", async () => {
  const failures = [];
  const evaluationError = new Error("evaluation");
  const cleanupError = new Error("cleanup");
  const intervals = [];
  const coordinator = createReminderCoordinator({
    evaluate: async () => { throw evaluationError; },
    processDue: async () => {},
    cleanup: async () => { throw cleanupError; },
    setTimeoutFn: () => 1, clearTimeoutFn() {},
    setIntervalFn: (callback) => { intervals.push(callback); return intervals.length; }, clearIntervalFn() {},
    logger: { warn() {}, info() {} },
    onError: (error) => failures.push(error),
  });
  coordinator.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(failures, [evaluationError, cleanupError]);
  coordinator.stop();
});
