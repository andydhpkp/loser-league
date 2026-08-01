const crypto = require("node:crypto");
const { UpstreamError } = require("../lib/errors");

function normalizeFixtureSchedule(feed, week) {
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
  const teams = [...new Set(games.flatMap((game) => [game.homeTeam, game.awayTeam]))].sort();
  return { contentHash, earliestKickoff: new Date(games[0].kickoff), normalizedSchedule, teams };
}

async function fetchFixtureSchedule({ year, week, fetchImpl = global.fetch, now = new Date(), timeoutMs = 10_000 }) {
  try {
    const response = await fetchImpl(`https://fixturedownload.com/feed/json/nfl-${year}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error("Fixture Download rejected request");
    return { ...normalizeFixtureSchedule(await response.json(), week), year, week, provider: "FIXTURE_DOWNLOAD", fetchedAt: now };
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    throw new UpstreamError(undefined, error);
  }
}

module.exports = { fetchFixtureSchedule, normalizeFixtureSchedule };
