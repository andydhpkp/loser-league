const { boundedTimeoutDelay } = require("../../lib/timers");

function createAutoPickCoordinator({
  evaluate,
  now = () => new Date(),
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  logger,
  onError = () => {},
}) {
  let interval;
  let deadlineTimer;
  let running = false;
  let blockedReason;
  let state = { status: "PENDING", deadline: null };

  async function run() {
    if (running) return { status: "PENDING" };
    running = true;
    try {
      const result = await evaluate();
      state = { status: result.status, deadline: result.deadline || state.deadline };
      blockedReason = undefined;
      if (deadlineTimer) clearTimeoutFn(deadlineTimer);
      if (result.deadline && result.status === "NOT_DUE") {
        const delay = boundedTimeoutDelay(result.deadline, now());
        deadlineTimer = setTimeoutFn(run, delay);
      }
      if (result.status === "COMPLETED") logger.info("auto_pick_completed", { assignedCount: result.assignedCount, week: result.week });
      return result;
    } catch (error) {
      void onError(error);
      state = { status: "BLOCKED", deadline: state.deadline };
      const reason = error.code || error.name;
      if (reason !== blockedReason) logger.warn("auto_pick_blocked", { reason });
      blockedReason = reason;
      return state;
    } finally {
      running = false;
    }
  }

  return {
    start() {
      void run();
      interval = setIntervalFn(run, 30_000);
    },
    stop() {
      if (interval) clearIntervalFn(interval);
      if (deadlineTimer) clearTimeoutFn(deadlineTimer);
    },
    evaluate: run,
    getState: () => ({ ...state }),
  };
}

module.exports = { createAutoPickCoordinator };
