function requireOpenSeason(season) {
  if (!season || season.state !== "ACTIVE" || !Number.isInteger(season.currentWeek) || ![1, 2].includes(season.pickCycle)) {
    throw new Error("An active League Season Pick cycle is required");
  }
}

function requireActiveTrack(track) {
  if (!track || track.eliminatedByPickId) throw new Error("An active Track is required");
}

function assertPool(track) {
  if (!Array.isArray(track.usedPicks) || !Array.isArray(track.availablePicks)
    || new Set(track.usedPicks).size !== track.usedPicks.length
    || new Set(track.availablePicks).size !== track.availablePicks.length
    || track.usedPicks.some((team) => track.availablePicks.includes(team))) {
    throw new Error("Track Pick pool is inconsistent");
  }
}

function planResetCurrentPick({ season, track, pick }) {
  requireOpenSeason(season);
  requireActiveTrack(track);
  assertPool(track);
  if (!pick || pick.week !== season.currentWeek || pick.pickCycle !== season.pickCycle || pick.outcome !== "PENDING") {
    throw new Error("A pending current-week Pick is required");
  }
  if (track.currentPick !== pick.teamName || track.usedPicks.at(-1) !== pick.teamName) {
    throw new Error("Current Pick projection is inconsistent");
  }
  return {
    deletePickId: pick.id,
    trackAfter: {
      currentPick: null,
      usedPicks: track.usedPicks.slice(0, -1),
      availablePicks: [...track.availablePicks, pick.teamName],
    },
  };
}

function validateNewCurrentPick({ season, track, teamName, scheduledTeams }) {
  requireOpenSeason(season);
  requireActiveTrack(track);
  assertPool(track);
  if (typeof teamName !== "string" || !scheduledTeams?.includes(teamName)) throw new Error("Team must be scheduled this week");
  if (!track.availablePicks.includes(teamName)) throw new Error("Team must be available in the current Pick cycle");
}

function planAssignCurrentPick({ season, track, teamName, scheduledTeams }) {
  validateNewCurrentPick({ season, track, teamName, scheduledTeams });
  if (track.currentPick) throw new Error("Track already has a current Pick");
  return {
    pickAfter: { week: season.currentWeek, teamName, outcome: "PENDING", origin: "SHARED_ADMIN_REPAIR", pickCycle: season.pickCycle },
    trackAfter: {
      currentPick: teamName,
      usedPicks: [...track.usedPicks, teamName],
      availablePicks: track.availablePicks.filter((team) => team !== teamName),
    },
  };
}

function planReplaceCurrentPick({ season, track, pick, teamName, scheduledTeams }) {
  validateNewCurrentPick({ season, track, teamName, scheduledTeams });
  if (!pick || pick.week !== season.currentWeek || pick.pickCycle !== season.pickCycle || pick.outcome !== "PENDING"
    || track.currentPick !== pick.teamName || track.usedPicks.at(-1) !== pick.teamName) {
    throw new Error("A consistent pending current Pick is required");
  }
  return {
    pickAfter: { teamName, origin: "SHARED_ADMIN_REPAIR", pickCycle: season.pickCycle },
    trackAfter: {
      currentPick: teamName,
      usedPicks: [...track.usedPicks.slice(0, -1), teamName],
      availablePicks: [...track.availablePicks.filter((team) => team !== teamName), pick.teamName],
    },
  };
}

function planBuybackReactivation({ track, eliminatingPick }) {
  if (!track?.eliminatedByPickId || !eliminatingPick || track.eliminatedByPickId !== eliminatingPick.id
    || eliminatingPick.outcome !== "WRONG_PICK" || track.wrongPick !== eliminatingPick.teamName) {
    throw new Error("A consistently eliminated Track is required");
  }
  return { waivedPickId: eliminatingPick.id, trackAfter: { eliminatedByPickId: null, wrongPick: null } };
}

function planPlayoffPoolReset({ season, tracks, teamNames, hasWeekPick, hasAutoPick }) {
  requireOpenSeason(season);
  if (season.currentWeek !== 19 || season.pickCycle !== 1) throw new Error("Playoff Pick reset is restricted to Week 19 cycle 1");
  if (hasWeekPick || hasAutoPick) throw new Error("Playoff Pick reset must occur before Week 19 Picks and auto-pick");
  if (!Array.isArray(teamNames) || !teamNames.length || new Set(teamNames).size !== teamNames.length) throw new Error("A valid Team catalog is required");
  if (tracks.some((track) => track.currentPick)) throw new Error("Every Track must have an empty current Pick");
  return {
    seasonAfter: { pickCycle: 2 },
    trackChanges: tracks.map((track) => ({ trackId: track.id, usedPicks: [], availablePicks: [...teamNames] })),
  };
}

function outcomeForTeam(teamName, games) {
  const game = games?.find((candidate) => candidate.status === "FINAL"
    && (candidate.homeTeam === teamName || candidate.awayTeam === teamName));
  if (!game) throw new Error("Team must have an authoritative final result");
  return game.tied || game.winnerTeam === teamName ? "WRONG_PICK" : "PREDICTION_CORRECT";
}

function planHistoricalPickCorrection({ pick, teamName, games, laterPicks }) {
  if (!pick || !Number.isInteger(pick.week) || pick.outcome === "PENDING") throw new Error("A settled historical Pick is required");
  if (typeof teamName !== "string" || !teamName || teamName === pick.teamName) throw new Error("Choose a different historical Team");
  const outcome = outcomeForTeam(teamName, games);
  if (outcome === "WRONG_PICK" && laterPicks?.length) throw new Error("A newly eliminating Pick cannot precede later Picks");
  return { teamName, outcome, origin: "SHARED_ADMIN_REPAIR" };
}

function planOutcomeReconciliation({ picks, games }) {
  if (!Array.isArray(picks) || !picks.length) throw new Error("At least one historical Pick is required");
  return picks.map((pick) => ({ pickId: pick.id, outcome: outcomeForTeam(pick.teamName, games) }));
}

function planTrackProjection({ season, picks, waivedPickIds = [], teamNames }) {
  requireOpenSeason(season);
  if (!Array.isArray(picks) || !Array.isArray(teamNames) || !teamNames.length) throw new Error("Normalized Picks and Team catalog are required");
  const ordered = [...picks].sort((left, right) => left.week - right.week || left.id - right.id);
  const currentCycle = ordered.filter((pick) => pick.pickCycle === season.pickCycle);
  const usedPicks = currentCycle.map((pick) => pick.teamName);
  if (new Set(usedPicks).size !== usedPicks.length) throw new Error("Current Pick cycle contains a reused Team");
  const current = currentCycle.find((pick) => pick.week === season.currentWeek && pick.outcome === "PENDING") || null;
  const waived = new Set(waivedPickIds);
  const eliminating = ordered.find((pick) => pick.outcome === "WRONG_PICK" && !waived.has(pick.id)) || null;
  return {
    currentPick: current?.teamName || null,
    usedPicks,
    availablePicks: teamNames.filter((teamName) => !usedPicks.includes(teamName)),
    wrongPick: eliminating?.teamName || null,
    eliminatedByPickId: eliminating?.id || null,
  };
}

module.exports = {
  planAssignCurrentPick,
  planBuybackReactivation,
  planPlayoffPoolReset,
  planReplaceCurrentPick,
  planResetCurrentPick,
  planHistoricalPickCorrection,
  planOutcomeReconciliation,
  planTrackProjection,
};
