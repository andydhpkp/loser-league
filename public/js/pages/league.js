import { leagueUserTableHandler } from "../modules/league-rendering.js";
import { logout } from "../logout.js";
import { fetchMatchesAndGetCurrentWeek } from "../teams.js";
import { bindWeekStatsModal } from "../utilityFunctions.js";

document.getElementById("logoutBtn")?.addEventListener("click", logout);
bindWeekStatsModal();
leagueUserTableHandler();
fetchMatchesAndGetCurrentWeek();
