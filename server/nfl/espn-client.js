const { UpstreamError } = require("../lib/errors");

const TEAMS_URL =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams";
const SCHEDULE_URL = "https://cdn.espn.com/core/nfl/schedule";

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

    fetchSchedule({ year, week }) {
      const url = new URL(SCHEDULE_URL);
      url.search = new URLSearchParams({
        xhr: "1",
        year: String(year),
        week: String(week),
      });
      return fetchJson(url);
    },
  };
}

module.exports = { createEspnClient };
