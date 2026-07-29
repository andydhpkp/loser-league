const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SENSITIVE_KEY = /password|secret|session|authorization|cookie|token/i;

function redact(value) {
  if (Array.isArray(value)) {
    return value.map(redact);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[REDACTED]" : redact(entry),
    ])
  );
}

function createLogger({ level = process.env.LOG_LEVEL || "info", output = console } = {}) {
  const threshold = LEVELS[level] || LEVELS.info;

  function write(logLevel, event, context = {}) {
    if (LEVELS[logLevel] < threshold) {
      return;
    }

    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      level: logLevel,
      event,
      ...redact(context),
    });

    const method = logLevel === "debug" ? "log" : logLevel;
    (output[method] || output.log).call(output, entry);
  }

  return {
    debug: (event, context) => write("debug", event, context),
    info: (event, context) => write("info", event, context),
    warn: (event, context) => write("warn", event, context),
    error: (event, context) => write("error", event, context),
  };
}

const logger = createLogger();

module.exports = { createLogger, logger, redact };
