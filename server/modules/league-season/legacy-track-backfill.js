function normalizedPick(value) {
  return typeof value === "string" ? value.trim() : "";
}

function planLegacyTrackBackfill({ currentWeek, track, weekOneBuyback = false }) {
  if (!Number.isInteger(currentWeek) || currentWeek < 0 || currentWeek > 22) {
    throw new Error("A valid League Season week is required");
  }

  const usedPicks = (track.usedPicks || []).map(normalizedPick);
  const availablePicks = (track.availablePicks || []).map(normalizedPick);
  const currentPick = normalizedPick(track.currentPick);
  const wrongPick = normalizedPick(track.wrongPick);

  if (weekOneBuyback && (wrongPick || usedPicks.length === 0)) {
    throw new Error("Week 1 buyback does not match active legacy Track state");
  }

  if (usedPicks.some((pick) => !pick) || availablePicks.some((pick) => !pick)) {
    throw new Error("Legacy Track contains an empty Team value");
  }
  if (new Set(usedPicks).size !== usedPicks.length) {
    throw new Error("Legacy Track reuses a Team in used Picks");
  }
  if (usedPicks.length > currentWeek) {
    throw new Error("Legacy Track has more Picks than the active week");
  }

  const availableSet = new Set(availablePicks);
  if (usedPicks.some((pick) => availableSet.has(pick))) {
    throw new Error("Legacy Track has a Team in both used and available Picks");
  }

  if (currentPick) {
    if (
      usedPicks.length !== currentWeek ||
      usedPicks[usedPicks.length - 1] !== currentPick
    ) {
      throw new Error("Legacy Track current Pick does not match the active week");
    }
  }

  const wrongPickIndexes = wrongPick
    ? usedPicks.reduce((indexes, pick, index) => {
        if (pick === wrongPick) {
          indexes.push(index);
        }
        return indexes;
      }, [])
    : [];
  if (wrongPick && wrongPickIndexes.length !== 1) {
    throw new Error("Legacy Track Wrong Pick is ambiguous");
  }

  const eliminatingPickWeek = wrongPickIndexes.length
    ? wrongPickIndexes[0] + 1
    : null;
  const picks = usedPicks.map((teamName, index) => {
    const week = index + 1;
    let outcome = "PREDICTION_CORRECT";
    if (week === eliminatingPickWeek || (weekOneBuyback && week === 1)) {
      outcome = "WRONG_PICK";
    } else if (week === currentWeek && teamName === currentPick) {
      outcome = "PENDING";
    }
    return { week, teamName, outcome };
  });

  return { trackId: track.id, eliminatingPickWeek, picks };
}

module.exports = { planLegacyTrackBackfill };
