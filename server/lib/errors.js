const UPSTREAM_FAILURES = new Set([
  "UPSTREAM_HTTP_STATUS",
  "UPSTREAM_TIMEOUT",
  "UPSTREAM_DNS",
  "UPSTREAM_TLS",
  "UPSTREAM_CONNECTION",
  "UPSTREAM_UNKNOWN",
]);

class AppError extends Error {
  constructor({ code, message, status = 500, cause }) {
    super(message, { cause });
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super({ code: "VALIDATION_ERROR", message, status: 400 });
  }
}

class AuthenticationError extends AppError {
  constructor(message = "Authentication required") {
    super({ code: "AUTHENTICATION_ERROR", message, status: 401 });
  }
}

class NotFoundError extends AppError {
  constructor(message) {
    super({ code: "NOT_FOUND", message, status: 404 });
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super({ code: "CONFLICT", message, status: 409 });
  }
}

class UpstreamError extends AppError {
  constructor(message = "NFL schedule data is unavailable", cause, diagnostics = {}) {
    super({ code: "UPSTREAM_ERROR", message, status: 502, cause });
    if (UPSTREAM_FAILURES.has(diagnostics.upstreamFailure)) {
      this.upstreamFailure = diagnostics.upstreamFailure;
    }
    if (
      diagnostics.upstreamFailure === "UPSTREAM_HTTP_STATUS" &&
      Number.isInteger(diagnostics.upstreamStatus) &&
      diagnostics.upstreamStatus >= 100 &&
      diagnostics.upstreamStatus <= 599
    ) {
      this.upstreamStatus = diagnostics.upstreamStatus;
    }
  }
}

module.exports = {
  AppError,
  AuthenticationError,
  ConflictError,
  NotFoundError,
  UpstreamError,
  ValidationError,
};
