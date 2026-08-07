const { ValidationError } = require("../../lib/errors");

const BUYBACK_PRICE_CENTS = 1000;
const BLOCKING_STATUSES = new Set(["ELIGIBLE", "PENDING_USER_REQUEST", "UNAVAILABLE"]);

function eligibleWeekOneTracks(tracks) {
  return eligibleBuybackTracks({ tracks, schedulePhase: "REGULAR" })
    .map(({ eliminatingWeek: _eliminatingWeek, ...track }) => track);
}

function eligibleBuybackTracks({ tracks, schedulePhase }) {
  const preseason = schedulePhase === "PRESEASON";
  return tracks.filter((track) => track.eliminatedByPickId
    && track.eliminatingPick?.id === track.eliminatedByPickId
    && (preseason || track.eliminatingPick.week === 1)
    && track.eliminatingPick.outcome === "WRONG_PICK")
    .map((track) => ({ trackId: track.id, pickId: track.eliminatingPick.id, teamName: track.eliminatingPick.teamName, eliminatingWeek: track.eliminatingPick.week }))
    .sort((a, b) => a.trackId - b.trackId);
}

function normalizeTrackIds(value) {
  if (!Array.isArray(value) || !value.length) throw new ValidationError("Select at least one Track");
  const ids = value.map(Number);
  if (ids.some((id) => !Number.isInteger(id) || id < 1)) throw new ValidationError("Track IDs must be positive integers");
  if (new Set(ids).size !== ids.length) throw new ValidationError("Track IDs must be unique");
  return ids.sort((a, b) => a - b);
}

function partitionResolution({ requestedTrackIds, fulfilledTrackIds }) {
  const requested = normalizeTrackIds(requestedTrackIds);
  if (!Array.isArray(fulfilledTrackIds) || !fulfilledTrackIds.length) throw new ValidationError("Complete request requires at least one fulfilled Track");
  const fulfilled = normalizeTrackIds(fulfilledTrackIds);
  if (fulfilled.some((id) => !requested.includes(id))) throw new ValidationError("Every fulfilled Track must be requested");
  return { fulfilledTrackIds: fulfilled, unfulfilledTrackIds: requested.filter((id) => !fulfilled.includes(id)), totalCents: fulfilled.length * BUYBACK_PRICE_CENTS };
}

function buybackView({ decision, tracks = [], presentation = {}, deadlineAvailable = true, schedulePhase }) {
  if (!decision) return null;
  const status = deadlineAvailable ? decision.status : "UNAVAILABLE";
  const selectedCount = decision.status === "ELIGIBLE" ? 0 : tracks.length;
  return {
    status,
    stateVersion: decision.stateVersion,
    pickBlocked: BLOCKING_STATUSES.has(status),
    unitPriceCents: BUYBACK_PRICE_CENTS,
    selectedCount,
    totalCents: selectedCount * BUYBACK_PRICE_CENTS,
    tracks: tracks.map((track) => ({ trackId: track.trackId, weekOnePick: track.teamName, resolution: track.resolution || null })),
    ...(schedulePhase ? { schedulePhase } : {}),
    contacts: Array.isArray(presentation.contacts) ? presentation.contacts : [],
    payment: presentation.payment || null,
  };
}

module.exports = { BUYBACK_PRICE_CENTS, BLOCKING_STATUSES, eligibleBuybackTracks, eligibleWeekOneTracks, normalizeTrackIds, partitionResolution, buybackView };
