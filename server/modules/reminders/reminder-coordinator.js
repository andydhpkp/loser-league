const { boundedTimeoutDelay } = require("../../lib/timers");

const RECOVERY_MS = 30_000;
const CLEANUP_MS = 24 * 60 * 60 * 1000;

function createReminderCoordinator({ evaluate, processDue, cleanup, now = () => new Date(), setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout, setIntervalFn = setInterval, clearIntervalFn = clearInterval, logger, onError = () => {} }) {
  let targetedTimer;
  let recoveryTimer;
  let cleanupTimer;
  let running = false;
  let blockedReason;

  async function run() {
    if (running) return { status: "PENDING" };
    running = true;
    try {
      const result = await evaluate();
      await processDue();
      blockedReason = undefined;
      if (targetedTimer) clearTimeoutFn(targetedTimer);
      if (result.nextCheckAt) targetedTimer = setTimeoutFn(run, boundedTimeoutDelay(result.nextCheckAt, now()));
      return result;
    } catch (error) {
      void onError(error);
      const reason = error.code || error.name;
      if (reason !== blockedReason) logger.warn("reminder_evaluation_blocked", { reason });
      blockedReason = reason;
      return { status: "BLOCKED" };
    } finally { running = false; }
  }

  async function runCleanup() {
    try { await cleanup(); } catch (error) { void onError(error); logger.warn("reminder_cleanup_blocked", { reason: error.code || error.name }); }
  }

  return {
    start() {
      void run();
      void runCleanup();
      recoveryTimer = setIntervalFn(run, RECOVERY_MS);
      cleanupTimer = setIntervalFn(runCleanup, CLEANUP_MS);
    },
    stop() {
      if (targetedTimer) clearTimeoutFn(targetedTimer);
      if (recoveryTimer) clearIntervalFn(recoveryTimer);
      if (cleanupTimer) clearIntervalFn(cleanupTimer);
    },
    evaluate: run,
  };
}

module.exports = { CLEANUP_MS, RECOVERY_MS, createReminderCoordinator };
