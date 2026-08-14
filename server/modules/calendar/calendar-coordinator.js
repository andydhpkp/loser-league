const REFRESH_MS = 15 * 60 * 1000;
const CLEANUP_MS = 24 * 60 * 60 * 1000;

function createCalendarCoordinator({ refresh, cleanup, setIntervalFn = setInterval, clearIntervalFn = clearInterval, logger }) {
  let refreshTimer; let cleanupTimer; let running = false;
  async function run() { if (running) return { status: "PENDING" }; running = true; try { return await refresh(); } catch (error) { logger.warn("calendar_refresh_blocked", { reason: error.code || error.name }); return { status: "BLOCKED" }; } finally { running = false; } }
  async function runCleanup() { try { return await cleanup(); } catch (error) { logger.warn("calendar_cleanup_blocked", { reason: error.code || error.name }); return { deleted: 0 }; } }
  return { start() { void run(); void runCleanup(); refreshTimer = setIntervalFn(run, REFRESH_MS); cleanupTimer = setIntervalFn(runCleanup, CLEANUP_MS); }, stop() { if (refreshTimer) clearIntervalFn(refreshTimer); if (cleanupTimer) clearIntervalFn(cleanupTimer); }, refresh: run };
}
module.exports = { CLEANUP_MS, REFRESH_MS, createCalendarCoordinator };
