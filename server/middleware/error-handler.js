const { AppError, UpstreamError } = require("../lib/errors");
const { isDatabaseCapacityError } = require("../infrastructure/database-capacity-recovery");

function createErrorHandler(logger, { onDatabaseCapacityFailure } = {}) {
  return function errorHandler(error, req, res, _next) {
    const databaseCapacityFailure = isDatabaseCapacityError(error);
    const expected = error instanceof AppError;
    const status = databaseCapacityFailure ? 503 : expected ? error.status : 500;
    const code = databaseCapacityFailure ? "SERVICE_UNAVAILABLE" : expected ? error.code : "INTERNAL_ERROR";
    const message = databaseCapacityFailure
      ? "Loser League is temporarily unavailable. Try again shortly."
      : expected
      ? error.message
      : "An unexpected error occurred";

    if (databaseCapacityFailure) {
      res.set("Retry-After", "30");
      void onDatabaseCapacityFailure?.(error);
    }

    logger.error("request_failed", {
      requestId: req.requestId,
      method: req.method,
      route: req.route?.path || req.path,
      status,
      errorCode: code,
      errorType: error.name,
      ...(error instanceof UpstreamError && error.upstreamFailure
        ? {
            upstreamFailure: error.upstreamFailure,
            ...(error.upstreamStatus ? { upstreamStatus: error.upstreamStatus } : {}),
          }
        : {}),
    });

    res.status(status).json({ error: code, message });
  };
}

module.exports = { createErrorHandler };
