function isDebugEnabled() {
  return window.localStorage.getItem("loserLeagueDebug") === "true";
}

export const browserLogger = {
  debug(...details) {
    if (isDebugEnabled()) {
      console.debug(...details);
    }
  },
  info(...details) {
    console.info(...details);
  },
  warn(...details) {
    console.warn(...details);
  },
  error(message, error) {
    console.error(message, error instanceof Error ? error.message : error);
  },
};
