const test = require("node:test");
const assert = require("node:assert/strict");
const { createCalendarCoordinator, REFRESH_MS } = require("../../server/modules/calendar/calendar-coordinator");

test("calendar coordinator refreshes and cleans at startup, recovers periodically, and stops", async () => {
  const intervals = []; const cleared = []; let refreshes = 0; let cleanups = 0;
  const coordinator = createCalendarCoordinator({ refresh: async () => { refreshes += 1; }, cleanup: async () => { cleanups += 1; }, setIntervalFn: (fn, delay) => { intervals.push({ fn, delay }); return intervals.length; }, clearIntervalFn: (id) => cleared.push(id), logger: { warn() {} } });
  coordinator.start(); await new Promise((resolve) => setImmediate(resolve));
  assert.equal(refreshes, 1); assert.equal(cleanups, 1); assert.equal(intervals[0].delay, REFRESH_MS);
  await intervals[0].fn(); assert.equal(refreshes, 2); coordinator.stop(); assert.deepEqual(cleared, [1, 2]);
});

test("calendar coordinator reports refresh and cleanup failures", async () => {
  const failures = []; const refreshError = new Error("refresh"); const cleanupError = new Error("cleanup");
  const coordinator = createCalendarCoordinator({
    refresh: async () => { throw refreshError; }, cleanup: async () => { throw cleanupError; },
    setIntervalFn: () => 1, clearIntervalFn() {}, logger: { warn() {} },
    onError: (error) => failures.push(error),
  });
  coordinator.start(); await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(failures, [refreshError, cleanupError]);
  coordinator.stop();
});
