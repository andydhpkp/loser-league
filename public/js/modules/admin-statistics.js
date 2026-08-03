function displayName(user) {
  return `${user.first_name || ""} ${user.last_name || ""}`.trim();
}

function tracksForSeason(user, leagueSeasonId) {
  const tracks = Array.isArray(user.tracks) ? user.tracks : Array.isArray(user.Tracks) ? user.Tracks : [];
  if (!Number.isInteger(Number(leagueSeasonId)) || Number(leagueSeasonId) < 1) return [];
  return tracks.filter((track) => Number(track.league_season_id) === Number(leagueSeasonId));
}

function isActive(track) {
  return !track.eliminated_by_pick_id && !track.wrong_pick;
}

function pluralizeTracks(count) {
  return `${count} ${count === 1 ? "Track" : "Tracks"}`;
}

export function computeAdminStatistics(users, leagueSeasonId) {
  const userTrackCounts = users.map((user) => {
    const tracks = tracksForSeason(user, leagueSeasonId);
    return { name: displayName(user), tracks, activeTracks: tracks.filter(isActive).length };
  }).filter(({ tracks }) => tracks.length > 0);
  const currentPicks = userTrackCounts.flatMap(({ tracks }) => tracks.map((track) => track.current_pick).filter(Boolean));
  const pickCounts = currentPicks.reduce((counts, pick) => {
    counts.set(pick, (counts.get(pick) || 0) + 1);
    return counts;
  }, new Map());
  const formatPopularity = (targetCount) => {
    if (!pickCounts.size) return "Unavailable — no current Picks";
    const teams = [...pickCounts.entries()].filter(([, count]) => count === targetCount).map(([team]) => team).sort();
    return `${teams.join(", ")} (${((targetCount / currentPicks.length) * 100).toFixed(2)}% of current Picks)`;
  };
  const counts = [...pickCounts.values()];
  const formatTrackExtrema = (targetCount) => {
    if (!userTrackCounts.length) return "Unavailable — no Users with Tracks";
    const names = userTrackCounts.filter(({ activeTracks }) => activeTracks === targetCount).map(({ name }) => name).sort();
    return `${names.join(", ")} (${pluralizeTracks(targetCount)})`;
  };
  const activeCounts = userTrackCounts.map(({ activeTracks }) => activeTracks);

  return {
    mostPopular: formatPopularity(counts.length ? Math.max(...counts) : 0),
    leastPopular: formatPopularity(counts.length ? Math.min(...counts) : 0),
    usersEliminated: userTrackCounts.filter(({ activeTracks }) => activeTracks === 0).length,
    usersLeft: userTrackCounts.filter(({ activeTracks }) => activeTracks > 0).length,
    tracksLeft: activeCounts.reduce((sum, count) => sum + count, 0),
    usersWithMostTracks: formatTrackExtrema(activeCounts.length ? Math.max(...activeCounts) : 0),
    usersWithLeastTracks: formatTrackExtrema(activeCounts.length ? Math.min(...activeCounts) : 0),
  };
}

export function computeRiskiestPick(users, leagueSeasonId, oddsData) {
  const pickersByTeam = new Map();
  users.forEach((user) => {
    tracksForSeason(user, leagueSeasonId).forEach((track) => {
      if (!track.current_pick) return;
      const pickers = pickersByTeam.get(track.current_pick) || new Set();
      pickers.add(displayName(user));
      pickersByTeam.set(track.current_pick, pickers);
    });
  });

  const matchingOutcomes = (Array.isArray(oddsData) ? oddsData : []).flatMap((game) =>
    (game.bookmakers || []).flatMap((bookmaker) =>
      (bookmaker.markets || []).flatMap((market) => market.outcomes || [])
    )
  ).filter((outcome) => pickersByTeam.has(outcome.name) && Number.isFinite(Number(outcome.point)));
  if (!matchingOutcomes.length) return null;
  const riskiest = matchingOutcomes.reduce((current, outcome) =>
    Number(outcome.point) < Number(current.point) ? outcome : current
  );
  return {
    team: riskiest.name,
    spread: Number(riskiest.point),
    users: [...pickersByTeam.get(riskiest.name)].sort(),
  };
}
