const { AppError, UpstreamError } = require("../lib/errors");

function createErrorHandler(logger) {
  return function errorHandler(error, req, res, _next) {
    const expected = error instanceof AppError;
    const status = expected ? error.status : 500;
    const code = expected ? error.code : "INTERNAL_ERROR";
    const message = expected
      ? error.message
      : "An unexpected error occurred";

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
