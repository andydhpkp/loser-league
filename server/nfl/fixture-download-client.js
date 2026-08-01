const crypto = require("node:crypto");
const { UpstreamError } = require("../lib/errors");

function normalizeFixtureSchedule(feed, week) {
  if (!Array.isArray(feed)) throw new UpstreamError("NFL schedule data is invalid");
  const games = feed
    .filter((game) => Number(game.RoundNumber) === week)
    .map((game) => ({
      kickoff: new Date(game.DateUtc).toISOString(),
      homeTeam: String(game.HomeTeam || "").trim(),
      awayTeam: String(game.AwayTeam || "").trim(),
    }))
    .filter((game) => game.homeTeam && game.awayTeam)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  if (!games.length) throw new UpstreamError("NFL schedule data is invalid");
  const normalizedSchedule = { week, games };
  const contentHash = crypto.createHash("sha256").update(JSON.stringify(normalizedSchedule)).digest("hex");
  const teams = [...new Set(games.flatMap((game) => [game.homeTeam, game.awayTeam]))].sort();
  return { contentHash, earliestKickoff: new Date(games[0].kickoff), normalizedSchedule, teams };
}

async function fetchFixtureSchedule({ year, week, fetchImpl = global.fetch, now = new Date() }) {
  try {
    const response = await fetchImpl(`https://fixturedownload.com/feed/json/nfl-${year}`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Fixture Download rejected request");
    return { ...normalizeFixtureSchedule(await response.json(), week), year, week, provider: "FIXTURE_DOWNLOAD", fetchedAt: now };
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    throw new UpstreamError(undefined, error);
  }
}

module.exports = { fetchFixtureSchedule, normalizeFixtureSchedule };
