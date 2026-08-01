import { browserLogger } from "../logger.js";
import { fetchNflSchedule } from "./nfl-data.js";

function terminalTeams(schedule) {
  const winners = new Set();
  const losers = new Set();
  for (const day of Object.values(schedule?.content?.schedule || {})) {
    for (const game of day.games || []) {
      if (game?.status?.type?.completed !== true) continue;
      const competitors = game?.competitions?.[0]?.competitors;
      if (!Array.isArray(competitors) || competitors.length !== 2) continue;
      const home = competitors.find((competitor) => competitor.homeAway === "home");
      const away = competitors.find((competitor) => competitor.homeAway === "away");
      const homeTeam = home?.team?.displayName;
      const awayTeam = away?.team?.displayName;
      const homeScore = Number(home?.score);
      const awayScore = Number(away?.score);
      if (!homeTeam || !awayTeam || !Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;
      if (homeScore === awayScore) {
        winners.add(homeTeam);
        winners.add(awayTeam);
      } else if (homeScore > awayScore) {
        winners.add(homeTeam);
        losers.add(awayTeam);
      } else {
        winners.add(awayTeam);
        losers.add(homeTeam);
      }
    }
  }
  return { winners, losers };
}

export async function finalScores({
  year,
  week,
  root = document,
  fetchScheduleImpl = fetchNflSchedule,
} = {}) {
  if (!Number.isInteger(year) || !Number.isInteger(week)) return;
  try {
    const response = await fetchScheduleImpl(year, week);
    if (!response.ok) throw new Error("NFL results are unavailable");
    const { winners, losers } = terminalTeams(await response.json());
    const pickCells = root.getElementsByClassName("teamNames");
    for (const cell of pickCells) {
      const teamName = cell.children?.[0]?.innerText;
      if (winners.has(teamName)) {
        cell.classList.add("loser");
        cell.classList.remove("winner");
      } else if (losers.has(teamName)) {
        cell.classList.add("winner");
        cell.classList.remove("loser");
      }
    }
  } catch (error) {
    browserLogger.error("Unable to render final NFL results", { errorType: error.name });
  }
}

export { terminalTeams };
