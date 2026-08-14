const { LeagueSeason } = require("../../../models");
const { UpstreamError } = require("../../lib/errors");
const { validateSeasonRounds } = require("./calendar-schedule");

function createCalendarScheduleLoader({ fetchImpl = global.fetch, findSeason = () => LeagueSeason.findOne({ where: { open_slot: 1 } }) } = {}) {
  return async function loadCalendarSchedule() {
    const season = await findSeason();
    if (!season || season.state !== "ACTIVE" || season.current_week < 1) return { season, evidence: [], invalidKeys: [] };
    const year = season.year;
    if (season.schedule_phase === "PRESEASON") {
      const rounds = [];
      for (let round = 1; round <= 4; round += 1) {
        const url = new URL("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard");
        url.search = new URLSearchParams({ dates: String(year), seasontype: "1", week: String(round) });
        let response;
        try { response = await fetchImpl(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) }); }
        catch (error) { throw new UpstreamError(undefined, error); }
        if (!response.ok) throw new UpstreamError("NFL schedule data is unavailable");
        const scoreboard = await response.json();
        const games = Array.isArray(scoreboard?.events) ? scoreboard.events.map((event) => { const competitors = event?.competitions?.[0]?.competitors || []; return { kickoff: event?.date, homeTeam: competitors.find((team) => team.homeAway === "home")?.team?.displayName, awayTeam: competitors.find((team) => team.homeAway === "away")?.team?.displayName }; }) : null;
        rounds.push({ round, games });
      }
      const checked = validateSeasonRounds({ year, phase: "PRESEASON", rounds });
      return { season, evidence: checked.valid, invalidKeys: checked.invalidRounds.map((round) => `${year}:PRESEASON:${round}`) };
    }
    let response;
    try { response = await fetchImpl(`https://fixturedownload.com/feed/json/nfl-${year}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) }); }
    catch (error) { throw new UpstreamError(undefined, error); }
    if (!response.ok) throw new UpstreamError("NFL schedule data is unavailable");
    const feed = await response.json();
    if (!Array.isArray(feed)) throw new UpstreamError("NFL schedule data is invalid");
    const grouped = new Map();
    for (const game of feed) {
      const round = Number(game.RoundNumber);
      if (!Number.isInteger(round) || round < 1 || round > 22) continue;
      if (!grouped.has(round)) grouped.set(round, []);
      grouped.get(round).push({ kickoff: game.DateUtc, homeTeam: game.HomeTeam, awayTeam: game.AwayTeam });
    }
    const rounds = [...grouped].map(([round, games]) => ({ round, games }));
    const regular = validateSeasonRounds({ year, phase: "REGULAR", rounds: rounds.filter(({ round }) => round <= 18) });
    const playoff = validateSeasonRounds({ year, phase: "PLAYOFF", rounds: rounds.filter(({ round }) => round > 18) });
    return { season, evidence: [...regular.valid, ...playoff.valid], invalidKeys: [...regular.invalidRounds.map((round) => `${year}:REGULAR:${round}`), ...playoff.invalidRounds.map((round) => `${year}:PLAYOFF:${round}`)] };
  };
}
module.exports = { createCalendarScheduleLoader };
