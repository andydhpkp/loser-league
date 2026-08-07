function eligibleTeamsForTrack({ scheduledTeams, priorTeamNames }) {
  const used = new Set(priorTeamNames);
  return scheduledTeams.filter((teamName) => !used.has(teamName));
}

function currentPickVisibility({ activeTrackIds, pickedTrackIds }) {
  const picked = new Set(pickedTrackIds);
  return activeTrackIds.every((trackId) => picked.has(trackId))
    ? "VISIBLE"
    : "HIDDEN";
}

function leagueViewAccess({ week, activeTrackIds, pickedTrackIds }) {
  if (Number(week) === 0 || activeTrackIds.length === 0) return "ALLOWED";
  return currentPickVisibility({ activeTrackIds, pickedTrackIds }) === "VISIBLE"
    ? "ALLOWED"
    : "BLOCKED";
}

module.exports = { currentPickVisibility, eligibleTeamsForTrack, leagueViewAccess };
