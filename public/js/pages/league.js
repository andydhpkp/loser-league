import { leagueUserTableHandler } from "../modules/league-rendering.js";
import { logout } from "../logout.js";
import { bindWeekStatsModal } from "../utilityFunctions.js";
import { createLeagueLogoRepaint } from "../modules/league-logo-repaint.js";

let logoRepaint = createLeagueLogoRepaint();
window.addEventListener("pagehide", () => logoRepaint.dispose());
window.addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  logoRepaint.dispose();
  logoRepaint = createLeagueLogoRepaint();
  document.querySelectorAll("#leagueMain .teamLogos").forEach(logoRepaint.observe);
});

document.getElementById("logoutBtn")?.addEventListener("click", logout);
bindWeekStatsModal();
leagueUserTableHandler({ observeLogo: (image) => logoRepaint.observe(image) });
