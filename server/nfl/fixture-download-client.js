const crypto = require("node:crypto");
const { UpstreamError } = require("../lib/errors");

function normalizeFixtureSchedule(feed, week, { now, allowStartedGames = false } = {}) {
  if (!Array.isArray(feed)) throw new UpstreamError("NFL schedule data is invalid");
  const games = [];
  const exactGames = new Set();
  const matchupKickoffs = new Map();
  const teamGames = new Map();
  for (const rawGame of feed.filter((game) => Number(game.RoundNumber) === week)) {
    const homeTeam = String(rawGame.HomeTeam || "").trim();
    const awayTeam = String(rawGame.AwayTeam || "").trim();
    const parsedKickoff = new Date(rawGame.DateUtc);
    if (!homeTeam || !awayTeam || homeTeam === awayTeam || Number.isNaN(parsedKickoff.getTime())) throw new UpstreamError("NFL schedule data is invalid");
    const kickoff = parsedKickoff.toISOString();
    const matchupKey = [homeTeam, awayTeam].sort().join("|");
    const exactKey = `${matchupKey}|${kickoff}`;
    if (exactGames.has(exactKey)) continue;
    if (matchupKickoffs.has(matchupKey) && matchupKickoffs.get(matchupKey) !== kickoff) throw new UpstreamError("NFL schedule data is invalid");
    for (const teamName of [homeTeam, awayTeam]) {
      if (teamGames.has(teamName) && teamGames.get(teamName) !== matchupKey) throw new UpstreamError("NFL schedule data is invalid");
      teamGames.set(teamName, matchupKey);
    }
    exactGames.add(exactKey);
    matchupKickoffs.set(matchupKey, kickoff);
    games.push({ kickoff, homeTeam, awayTeam });
  }
  games.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  if (!games.length) throw new UpstreamError("NFL schedule data is invalid");
  const normalizedSchedule = { week, games };
  const contentHash = crypto.createHash("sha256").update(JSON.stringify(normalizedSchedule)).digest("hex");
  const selectableGames = allowStartedGames ? games.filter((game) => new Date(game.kickoff) > new Date(now)) : games;
  const teams = [...new Set(selectableGames.flatMap((game) => [game.homeTeam, game.awayTeam]))].sort();
  return { contentHash, earliestKickoff: new Date((selectableGames[0] || games[0]).kickoff), normalizedSchedule, teams };
}

function normalizeEspnFixtureSchedule(scoreboard, week, now = new Date()) {
  if (!Array.isArray(scoreboard?.events)) throw new UpstreamError("NFL schedule data is invalid");
  const games = scoreboard.events.map((event) => {
    const competition = event?.competitions?.[0];
    const competitors = competition?.competitors || [];
    const homeTeam = String(competitors.find((team) => team.homeAway === "home")?.team?.displayName || "").trim();
    const awayTeam = String(competitors.find((team) => team.homeAway === "away")?.team?.displayName || "").trim();
    const parsedKickoff = new Date(event.date);
    if (!homeTeam || !awayTeam || homeTeam === awayTeam || Number.isNaN(parsedKickoff.getTime())) throw new UpstreamError("NFL schedule data is invalid");
    return { kickoff: parsedKickoff.toISOString(), homeTeam, awayTeam, completed: event?.status?.type?.completed === true };
  }).sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  if (!games.length) throw new UpstreamError("NFL schedule data is invalid");
  const normalizedSchedule = { week, games };
  const contentHash = crypto.createHash("sha256").update(JSON.stringify(normalizedSchedule)).digest("hex");
  const selectableGames = games.filter((game) => new Date(game.kickoff) > now);
  const teams = [...new Set(selectableGames.flatMap((game) => [game.homeTeam, game.awayTeam]))].sort();
  return { contentHash, earliestKickoff: new Date(games[0].kickoff), normalizedSchedule, teams, completed: games.every((game) => game.completed) };
}

async function fetchFixtureSchedule({ year, week, seasonPhase = "REGULAR", allowStartedGames = false, fetchImpl = global.fetch, now = new Date(), timeoutMs = 10_000 }) {
  try {
    if (seasonPhase === "PRESEASON") {
      const url = new URL("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard");
      url.search = new URLSearchParams({ dates: String(year), seasontype: "1", week: String(week) });
      const response = await fetchImpl(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) throw new Error("ESPN rejected request");
      return { ...normalizeEspnFixtureSchedule(await response.json(), week, now), year, week, seasonPhase, provider: "ESPN", fetchedAt: now };
    }
    const response = await fetchImpl(`https://fixturedownload.com/feed/json/nfl-${year}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error("Fixture Download rejected request");
    return { ...normalizeFixtureSchedule(await response.json(), week, { now, allowStartedGames }), year, week, provider: "FIXTURE_DOWNLOAD", fetchedAt: now };
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    throw new UpstreamError(undefined, error);
  }
}

async function fetchPreseasonWeeks({ year, fetchImpl = global.fetch, now = new Date() }) {
  const weeks = [];
  for (let week = 1; week <= 4; week += 1) {
    try {
      const schedule = await fetchFixtureSchedule({ year, week, seasonPhase: "PRESEASON", fetchImpl, now });
      weeks.push({ week, games: schedule.normalizedSchedule.games });
    } catch (error) {
      if (week <= 3) throw error;
    }
  }
  return weeks;
}

module.exports = { fetchFixtureSchedule, fetchPreseasonWeeks, normalizeEspnFixtureSchedule, normalizeFixtureSchedule };
