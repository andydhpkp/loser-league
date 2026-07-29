const { AppError } = require("../lib/errors");

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
      route: req.originalUrl,
      status,
      errorCode: code,
      errorType: error.name,
    });

    res.status(status).json({ error: code, message });
  };
}

module.exports = { createErrorHandler };
