const SUMMARY_INTERVAL_MS = 60 * 60 * 1000;

const STATIC_ASSET = /\.(?:css|gif|ico|jpe?g|js|json|map|png|svg|webmanifest|webp|woff2?)$/i;
const PAGE = /\.html$/i;

function classifyRequest({ path = "" } = {}) {
  if (path === "/" || path === "/api/nfl/teams") return "health";
  if (path.startsWith("/api/")) return "api";
  if (PAGE.test(path)) return "page";
  if (STATIC_ASSET.test(path)) return "static";
  return "other";
}

function statusCategory(statusCode) {
  if (statusCode >= 100 && statusCode < 200) return "informational";
  if (statusCode >= 200 && statusCode < 300) return "successful";
  if (statusCode >= 300 && statusCode < 400) return "redirection";
  if (statusCode >= 400 && statusCode < 500) return "clientError";
  if (statusCode >= 500 && statusCode < 600) return "serverError";
  return "unknown";
}

function emptyCounts() {
  return {
    total: 0,
    categories: { static: 0, health: 0, api: 0, page: 0, other: 0 },
    statuses: { informational: 0, successful: 0, redirection: 0, clientError: 0, serverError: 0, unknown: 0 },
  };
}

function createRequestVolumeMiddleware({ logger, now = () => new Date() } = {}) {
  let intervalStartedAt;
  let counts = emptyCounts();

  return function requestVolume(req, res, next) {
    res.on("finish", () => {
      const completedAt = now();
      intervalStartedAt ||= completedAt;

      if (completedAt.getTime() - intervalStartedAt.getTime() >= SUMMARY_INTERVAL_MS) {
        if (counts.total > 0) {
          logger.info("request_volume_completed", {
            intervalSeconds: SUMMARY_INTERVAL_MS / 1000,
            total: counts.total,
            categories: counts.categories,
            statuses: counts.statuses,
          });
        }
        counts = emptyCounts();
        intervalStartedAt = completedAt;
      }

      counts.total += 1;
      counts.categories[classifyRequest(req)] += 1;
      counts.statuses[statusCategory(res.statusCode)] += 1;
    });
    next();
  };
}

module.exports = {
  SUMMARY_INTERVAL_MS,
  classifyRequest,
  createRequestVolumeMiddleware,
};
