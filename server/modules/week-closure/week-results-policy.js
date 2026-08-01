function matchupKey(homeTeam, awayTeam) {
  return [homeTeam, awayTeam].sort().join("|");
}

function normalizeEspnGame(game) {
  const competitors = game?.competitions?.[0]?.competitors;
  if (!Array.isArray(competitors) || competitors.length !== 2) {
    throw new Error("ESPN weekly results are invalid");
  }
  const home = competitors.find((competitor) => competitor?.homeAway === "home");
  const away = competitors.find((competitor) => competitor?.homeAway === "away");
  const homeTeam = String(home?.team?.displayName || "").trim();
  const awayTeam = String(away?.team?.displayName || "").trim();
  if (!homeTeam || !awayTeam || homeTeam === awayTeam) {
    throw new Error("ESPN weekly results are invalid");
  }
  if (game?.status?.type?.completed !== true) {
    const providerStatus = String(game?.status?.type?.name || game?.status?.type?.description || "").toUpperCase();
    const delayed = ["DELAYED", "POSTPONED", "SUSPENDED"].some((value) => providerStatus.includes(value));
    return { homeTeam, awayTeam, status: delayed ? "DELAYED" : "PENDING" };
  }
  const rawHomeScore = home.score;
  const rawAwayScore = away.score;
  const homeScore = Number(rawHomeScore);
  const awayScore = Number(rawAwayScore);
  if (rawHomeScore === null || rawHomeScore === undefined || String(rawHomeScore).trim() === ""
    || rawAwayScore === null || rawAwayScore === undefined || String(rawAwayScore).trim() === ""
    || !Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
    throw new Error("ESPN weekly results are invalid");
  }
  const tied = homeScore === awayScore;
  return {
    homeTeam,
    awayTeam,
    status: "FINAL",
    winnerTeam: tied ? null : homeScore > awayScore ? homeTeam : awayTeam,
    loserTeam: tied ? null : homeScore < awayScore ? homeTeam : awayTeam,
    tied,
  };
}

function normalizeOverride(override) {
  const homeTeam = String(override?.homeTeam || "").trim();
  const awayTeam = String(override?.awayTeam || "").trim();
  const homeScore = Number(override?.homeScore);
  const awayScore = Number(override?.awayScore);
  if (!homeTeam || !awayTeam || homeTeam === awayTeam || !Number.isInteger(homeScore) || homeScore < 0 || !Number.isInteger(awayScore) || awayScore < 0) {
    throw new Error("Official weekly result override is invalid");
  }
  const tied = homeScore === awayScore;
  return {
    homeTeam,
    awayTeam,
    status: "FINAL",
    winnerTeam: tied ? null : homeScore > awayScore ? homeTeam : awayTeam,
    loserTeam: tied ? null : homeScore < awayScore ? homeTeam : awayTeam,
    tied,
  };
}

function reconcileWeeklyResults({ fixtureSchedule, espnSchedule, overrides = [] }) {
  const fixtureGames = fixtureSchedule?.games;
  const dates = espnSchedule?.content?.schedule;
  if (!Array.isArray(fixtureGames) || !dates || typeof dates !== "object") {
    throw new Error("Weekly result schedules are invalid");
  }
  const fixtureTeams = new Set();
  for (const game of fixtureGames) {
    const homeTeam = String(game?.homeTeam || "").trim();
    const awayTeam = String(game?.awayTeam || "").trim();
    if (!homeTeam || !awayTeam || homeTeam === awayTeam || fixtureTeams.has(homeTeam) || fixtureTeams.has(awayTeam)) {
      throw new Error("Fixture schedule is invalid");
    }
    fixtureTeams.add(homeTeam);
    fixtureTeams.add(awayTeam);
  }
  const espnByMatchup = new Map();
  for (const day of Object.values(dates)) {
    if (!Array.isArray(day?.games)) throw new Error("ESPN weekly results are invalid");
    for (const rawGame of day.games) {
      const game = normalizeEspnGame(rawGame);
      const key = matchupKey(game.homeTeam, game.awayTeam);
      if (espnByMatchup.has(key)) throw new Error("ESPN weekly results contain a duplicate matchup");
      espnByMatchup.set(key, game);
    }
  }
  const overrideByMatchup = new Map();
  for (const rawOverride of overrides) {
    const override = normalizeOverride(rawOverride);
    const key = matchupKey(override.homeTeam, override.awayTeam);
    if (overrideByMatchup.has(key)) throw new Error("Official weekly results contain a duplicate matchup");
    overrideByMatchup.set(key, override);
  }
  const fixtureKeys = new Set(fixtureGames.map((game) => matchupKey(game.homeTeam, game.awayTeam)));
  if ([...espnByMatchup.keys()].some((key) => !fixtureKeys.has(key))) {
    throw new Error("ESPN weekly result does not match the Fixture schedule");
  }
  if ([...overrideByMatchup.keys()].some((key) => !fixtureKeys.has(key))) {
    throw new Error("Official weekly result does not match the Fixture schedule");
  }
  const games = fixtureGames.map(({ homeTeam, awayTeam }) => {
    const key = matchupKey(homeTeam, awayTeam);
    const result = overrideByMatchup.get(key) || espnByMatchup.get(key);
    if (!result) return { homeTeam, awayTeam, status: "MISSING" };
    return { homeTeam, awayTeam, ...result };
  });
  return { games, allFinal: games.every((game) => game.status === "FINAL") };
}

function planPickOutcomes({ picks, games }) {
  const gameByTeam = new Map();
  for (const game of games) {
    if (game.status !== "FINAL") continue;
    gameByTeam.set(game.homeTeam, game);
    gameByTeam.set(game.awayTeam, game);
  }
  return picks.map(({ id, trackId, teamName }) => {
    const game = gameByTeam.get(teamName);
    if (!game) throw new Error("Every Pick must have an authoritative final result");
    const eliminated = game.tied || game.winnerTeam === teamName;
    return {
      pickId: id,
      trackId,
      teamName,
      outcome: eliminated ? "WRONG_PICK" : "PREDICTION_CORRECT",
      eliminated,
    };
  });
}

module.exports = { planPickOutcomes, reconcileWeeklyResults };
