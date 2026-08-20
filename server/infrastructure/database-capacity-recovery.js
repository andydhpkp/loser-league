const CAPACITY_PATTERN = /max_user_connections/i;
const DEFAULT_THRESHOLD = 3;
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_GRACE_MS = 10_000;

function errorChain(error) {
  const chain = [];
  const seen = new Set();
  let current = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    current = current.cause || current.original || current.parent;
  }
  return chain;
}

function isDatabaseCapacityError(error) {
  return errorChain(error).some((candidate) =>
    CAPACITY_PATTERN.test(String(candidate.message || ""))
  );
}

function createDatabaseCapacityRecovery({ threshold = DEFAULT_THRESHOLD, windowMs = DEFAULT_WINDOW_MS, now = Date.now, recover, logger }) {
  let failures = [];
  let triggered = false;
  return {
    async record(error) {
      if (triggered || !isDatabaseCapacityError(error)) return false;
      const currentTime = now();
      failures = failures.filter((time) => time >= currentTime - windowMs);
      failures.push(currentTime);
      logger.warn("database_capacity_failure_observed", { count: failures.length, threshold, windowSeconds: Math.floor(windowMs / 1000) });
      if (failures.length < threshold) return false;
      triggered = true;
      await recover();
      return true;
    },
  };
}

function closeServer(server) {
  if (!server) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function recoverDatabaseProcess({ server, lifecycleCoordinator, database, graceMs = DEFAULT_GRACE_MS, setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout, exit = process.exit, logger }) {
  logger.warn("database_capacity_recovery_started", { graceSeconds: Math.floor(graceMs / 1000) });
  lifecycleCoordinator?.stop();
  let deadlineTimer;
  const deadline = new Promise((resolve) => {
    deadlineTimer = setTimeoutFn(() => resolve("deadline"), graceMs);
    deadlineTimer?.unref?.();
  });
  const graceful = (async () => {
    await closeServer(server);
    await database.close();
    return "completed";
  })();
  try {
    const outcome = await Promise.race([graceful, deadline]);
    if (outcome === "completed") {
      clearTimeoutFn(deadlineTimer);
      logger.info("database_capacity_recovery_completed");
    } else {
      logger.error("database_capacity_recovery_deadline_exceeded");
      server?.closeAllConnections?.();
      void database.close().catch(() => {});
    }
  } catch (error) {
    logger.error("database_capacity_recovery_failed", { errorType: error.name });
  }
  exit(1);
}

module.exports = { DEFAULT_GRACE_MS, DEFAULT_THRESHOLD, DEFAULT_WINDOW_MS, createDatabaseCapacityRecovery, isDatabaseCapacityError, recoverDatabaseProcess };
