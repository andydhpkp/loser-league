const crypto = require("node:crypto");
const { ValidationError } = require("../../lib/errors");

function normalizeWinnerTrackIds(value) {
  if (!Array.isArray(value) || value.length === 0) throw new ValidationError("At least one winning Track is required");
  const ids = [...new Set(value.map(Number))].sort((a, b) => a - b);
  if (ids.some((id) => !Number.isInteger(id) || id < 1)) throw new ValidationError("Winning Track IDs must be positive integers");
  return ids;
}

function normalizeTargetYear(value) {
  if (typeof value !== "string" || !/^\d{4}$/.test(value)) throw new ValidationError("A four-digit target year is required");
  return Number(value);
}

function deriveWinningUsers(tracks) {
  const userIds = [...new Set(tracks.map((track) => track.user_id))].sort((a, b) => a - b);
  return { userIds, wonWithTie: userIds.length > 1 };
}

function buildRolloverExport({ season, tracks, picks }) {
  const payload = {
    format: "loser-league-season-export-v1",
    season: { id: season.id, year: season.year, completedWeek: season.current_week },
    tracks: tracks.map((track) => ({
      id: track.id,
      userId: track.user_id,
      currentPick: track.current_pick,
      usedPicks: track.used_picks,
      availablePicks: track.available_picks,
      wrongPick: track.wrong_pick,
      eliminatedByPickId: track.eliminated_by_pick_id,
      stateVersion: track.state_version,
    })),
    picks: picks.map((pick) => ({ id: pick.id, trackId: pick.track_id, week: pick.week, pickCycle: pick.pick_cycle, teamName: pick.team_name, origin: pick.origin, outcome: pick.outcome })),
  };
  const json = JSON.stringify(payload);
  return {
    exportDocument: payload,
    exportChecksum: crypto.createHash("sha256").update(json).digest("hex"),
    filename: `loser-league-${season.year}.json`,
    counts: { tracks: tracks.length, picks: picks.length },
  };
}

module.exports = { buildRolloverExport, deriveWinningUsers, normalizeTargetYear, normalizeWinnerTrackIds };
