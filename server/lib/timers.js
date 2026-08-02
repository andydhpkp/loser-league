const MAX_TIMEOUT_MS = 2_147_483_647;

function boundedTimeoutDelay(target, now) {
  return Math.min(MAX_TIMEOUT_MS, Math.max(0, target.getTime() - now.getTime()));
}

module.exports = { MAX_TIMEOUT_MS, boundedTimeoutDelay };
