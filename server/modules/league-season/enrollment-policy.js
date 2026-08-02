function isTrackEnrollmentOpen({ season, earliestKickoff, now = new Date() }) {
  if (!season) return false;
  if (season.state === "SETUP" && season.current_week === 0) return true;
  if (season.state !== "ACTIVE" || season.current_week !== 1) return false;
  if (!earliestKickoff) return true;
  const kickoff = new Date(earliestKickoff);
  return Number.isNaN(kickoff.getTime()) || new Date(now) < kickoff;
}

function earliestScheduleKickoff(snapshot) {
  const values = snapshot?.normalized_schedule?.games
    ?.map((game) => new Date(game.kickoff))
    .filter((value) => !Number.isNaN(value.getTime())) || [];
  return values.length ? new Date(Math.min(...values.map((value) => value.getTime()))) : null;
}

module.exports = { earliestScheduleKickoff, isTrackEnrollmentOpen };
