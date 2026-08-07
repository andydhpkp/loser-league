const { UpstreamError } = require("../lib/errors");

const TEAMS_URL =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams";
const SCHEDULE_URL =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

function normalizeSchedule(scoreboard) {
  if (!Array.isArray(scoreboard?.events)) {
    throw new UpstreamError("NFL data is unavailable");
  }

  const schedule = {};
  for (const event of scoreboard.events) {
    const date = typeof event?.date === "string" ? event.date.slice(0, 10) : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new UpstreamError("NFL data is unavailable");
    }
    schedule[date] ||= { games: [] };
    schedule[date].games.push(event);
  }

  return { content: { schedule } };
}

function createEspnClient({ fetchImpl = global.fetch, timeoutMs = 5000 } = {}) {
  async function fetchJson(url) {
    try {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        throw new UpstreamError("NFL data is unavailable");
      }

      return await response.json();
    } catch (error) {
      throw error instanceof UpstreamError
        ? error
        : new UpstreamError("NFL data is unavailable", error);
    }
  }

  return {
    fetchTeams() {
      return fetchJson(TEAMS_URL);
    },

    async fetchSchedule({ year, week, seasonType = "regular" }) {
      const url = new URL(SCHEDULE_URL);
      const preseason = seasonType === "preseason";
      const postseason = !preseason && week > 18;
      url.search = new URLSearchParams({
        dates: String(year),
        seasontype: preseason ? "1" : postseason ? "3" : "2",
        week: String(postseason ? week - 18 : week),
      });
      return normalizeSchedule(await fetchJson(url));
    },
  };
}

module.exports = { createEspnClient, normalizeSchedule };
