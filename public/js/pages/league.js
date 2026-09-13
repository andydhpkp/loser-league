import { leagueUserTableHandler } from "../modules/league-rendering.js";
import { logout } from "../logout.js";
import { bindWeekStatsModal } from "../utilityFunctions.js";
import { createLeagueLogoRepaint } from "../modules/league-logo-repaint.js";
import { createLeagueLogoDiagnostics } from "../modules/league-logo-diagnostics.js";

let stopDiagnostics = () => {};
function startDiagnostics() {
  const flags = new window.URLSearchParams(window.location.search).getAll("logoDiagnostics");
  if (flags.length !== 1 || flags[0] !== "1") return;
  const root = document.getElementById("leagueMain");
  const diagnostics = createLeagueLogoDiagnostics({ root });
  root.addEventListener("click", diagnostics.inspect);
  root.addEventListener("load", diagnostics.recordLoad, true);
  root.addEventListener("error", diagnostics.recordError, true);
  diagnostics.copyButton.addEventListener("click", diagnostics.copyReport);
  diagnostics.refreshButton.addEventListener("click", diagnostics.refreshReport);
  stopDiagnostics = () => {
    root.removeEventListener("click", diagnostics.inspect);
    root.removeEventListener("load", diagnostics.recordLoad, true);
    root.removeEventListener("error", diagnostics.recordError, true);
    diagnostics.copyButton.removeEventListener("click", diagnostics.copyReport);
    diagnostics.refreshButton.removeEventListener("click", diagnostics.refreshReport);
    diagnostics.dispose();
  };
}
startDiagnostics();

let logoRepaint = createLeagueLogoRepaint();
window.addEventListener("pagehide", () => {
  logoRepaint.dispose();
  stopDiagnostics();
});
window.addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  stopDiagnostics();
  startDiagnostics();
  logoRepaint.dispose();
  logoRepaint = createLeagueLogoRepaint();
  document.querySelectorAll("#leagueMain .teamLogos").forEach(logoRepaint.observe);
});

document.getElementById("logoutBtn")?.addEventListener("click", logout);
bindWeekStatsModal();
leagueUserTableHandler({ observeLogo: (image) => logoRepaint.observe(image) });
