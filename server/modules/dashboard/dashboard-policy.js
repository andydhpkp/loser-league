function makePicksStatus(state, active, missing) {
  if (!state.scheduleAvailable && state.leagueSeason.state === "ACTIVE" && state.leagueSeason.week > 0) return { code: "LIFECYCLE_UNAVAILABLE", label: "Pick status is temporarily unavailable" };
  if (state.leagueSeason.week === 0 || state.leagueSeason.state === "SETUP") return { code: "SEASON_NOT_STARTED", label: "Season has not started" };
  if (state.leagueSeason.state === "COMPLETED") return { code: "SEASON_COMPLETE", label: "League Season is complete" };
  if (active === 0) return { code: "NO_ACTIVE_TRACKS", label: "No Picks required" };
  if (state.buyback?.pickBlocked) return { code: "BUYBACK_BLOCKED", label: `Resolve your ${state.leagueSeason.schedulePhase === "PRESEASON" ? "preseason" : "Week 2"} buyback first` };
  if (!state.submissionOpen) return { code: "SUBMISSION_CLOSED", label: "Pick submission is closed" };
  if (missing === 0) return { code: "ALL_SUBMITTED", label: "All Picks submitted" };
  return { code: "PICKS_REQUIRED", label: "Submit this week's Picks" };
}

function dashboardSummary(state, featureAccess = {}) {
  const tracks = Array.isArray(state.tracks) ? state.tracks : [];
  const active = tracks.length;
  const missing = tracks.filter((track) => track.status === "NOT_SUBMITTED").length;
  const picksSubmitted = active === 0 || state.leagueSeason.week === 0 || state.leagueSeason.state === "SETUP" || state.leagueSeason.state === "COMPLETED"
    ? null
    : missing === 0;
  const deadlineAvailable = state.scheduleAvailable === true && typeof state.deadline === "string";
  const leagueViewAllowed = state.leagueSeason.week === 0 || active === 0 || missing === 0;
  return {
    leagueSeason: { year: state.leagueSeason.year, week: state.leagueSeason.week, state: state.leagueSeason.state, ...(state.leagueSeason.schedulePhase ? { schedulePhase: state.leagueSeason.schedulePhase } : {}) },
    deadline: { available: deadlineAvailable, timestamp: deadlineAvailable ? state.deadline : null },
    tracks: { active, picksSubmitted },
    leagueView: { allowed: leagueViewAllowed, label: leagueViewAllowed ? "See the current league standings and visible Picks." : "Submit Picks for all active Tracks before viewing the League." },
    makePicks: makePicksStatus(state, active, missing),
    features: { pickReminders: featureAccess.pickReminders === true },
  };
}

module.exports = { dashboardSummary };
