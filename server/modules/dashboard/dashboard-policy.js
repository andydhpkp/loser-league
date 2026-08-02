function makePicksStatus(state, active, missing) {
  if (!state.scheduleAvailable && state.leagueSeason.state === "ACTIVE" && state.leagueSeason.week > 0) return { code: "LIFECYCLE_UNAVAILABLE", label: "Pick status is temporarily unavailable" };
  if (state.leagueSeason.week === 0 || state.leagueSeason.state === "SETUP") return { code: "SEASON_NOT_STARTED", label: "Season has not started" };
  if (state.leagueSeason.state === "COMPLETED") return { code: "SEASON_COMPLETE", label: "League Season is complete" };
  if (active === 0) return { code: "NO_ACTIVE_TRACKS", label: "No active Tracks" };
  if (state.buyback?.pickBlocked) return { code: "BUYBACK_BLOCKED", label: "Resolve your Week 2 buyback first" };
  if (!state.submissionOpen) return { code: "SUBMISSION_CLOSED", label: "Pick submission is closed" };
  if (missing === 0) return { code: "ALL_SUBMITTED", label: "All Picks submitted" };
  return { code: "PICKS_REQUIRED", label: `${missing} Pick${missing === 1 ? "" : "s"} still needed` };
}

function dashboardSummary(state) {
  const tracks = Array.isArray(state.tracks) ? state.tracks : [];
  const active = tracks.length;
  const missing = tracks.filter((track) => track.status === "NOT_SUBMITTED").length;
  const deadlineAvailable = state.scheduleAvailable === true && typeof state.deadline === "string";
  return {
    leagueSeason: { year: state.leagueSeason.year, week: state.leagueSeason.week, state: state.leagueSeason.state },
    deadline: { available: deadlineAvailable, timestamp: deadlineAvailable ? state.deadline : null },
    tracks: { active, missingPicks: missing },
    makePicks: makePicksStatus(state, active, missing),
    features: { textPickReminders: false },
  };
}

module.exports = { dashboardSummary };
