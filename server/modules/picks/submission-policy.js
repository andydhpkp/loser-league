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

module.exports = { currentPickVisibility, eligibleTeamsForTrack };
