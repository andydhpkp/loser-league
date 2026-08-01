function createWeekClosureCoordinator({
  evaluate,
  now = () => new Date(),
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  logger,
}) {
  let timer;
  let recovery;
  let running = false;
  let blockedReason;
  let state = { status: "PENDING", nextCheckAt: null };

  async function run() {
    if (running) return state;
    running = true;
    try {
      const result = await evaluate();
      state = { status: result.status, nextCheckAt: result.nextCheckAt || null };
      blockedReason = undefined;
      if (timer) clearTimeoutFn(timer);
      if (result.nextCheckAt) {
        const delay = Math.max(0, result.nextCheckAt.getTime() - now().getTime());
        timer = setTimeoutFn(run, delay);
      }
      if (result.status === "COMPLETED") {
        logger.info("week_closure_completed", { week: result.week, eliminatedCount: result.eliminatedCount });
      }
      return result;
    } catch (error) {
      state = { status: "BLOCKED", nextCheckAt: state.nextCheckAt };
      const reason = error.code || error.name;
      if (reason !== blockedReason) logger.warn("week_closure_blocked", { reason });
      blockedReason = reason;
      return state;
    } finally {
      running = false;
    }
  }

  return {
    start() {
      void run();
      recovery = setIntervalFn(run, 5 * 60 * 1000);
    },
    stop() {
      if (timer) clearTimeoutFn(timer);
      if (recovery) clearIntervalFn(recovery);
    },
    evaluate: run,
    getState: () => ({ ...state }),
  };
}

module.exports = { createWeekClosureCoordinator };
