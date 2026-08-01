const { ValidationError } = require("../../lib/errors");
const { eligibleTeamsForTrack } = require("./submission-policy");

function autoPickDue({ now, deadline }) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime()) || !(deadline instanceof Date) || Number.isNaN(deadline.getTime())) {
    throw new ValidationError("Auto-pick time is invalid");
  }
  return now >= deadline;
}

function planAutomaticSelections({ tracks, scheduledTeams, randomIndex }) {
  return tracks.map((track) => {
    const eligible = eligibleTeamsForTrack({ scheduledTeams, priorTeamNames: track.priorTeamNames });
    if (!eligible.length) throw new ValidationError(`Track ${track.id} has no eligible Team`);
    const index = randomIndex(eligible.length);
    if (!Number.isInteger(index) || index < 0 || index >= eligible.length) throw new ValidationError("Random selection is invalid");
    return { trackId: track.id, teamName: eligible[index] };
  });
}

module.exports = { autoPickDue, planAutomaticSelections };
