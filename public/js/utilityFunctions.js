import { browserLogger } from "./logger.js";
import { computeWeekStats, sortUsersByTracksLeft } from "./modules/league-stats.js";

export { computeWeekStats, sortUsersByTracksLeft };

const CROWN_INFO_BY_TYPE = Object.freeze({
  solo_1: Object.freeze({
    src: "/css/assets/crowns/first_time_solo_winner_crown.png",
    alt: "Crown for a first-time solo winner",
  }),
  tied_1: Object.freeze({
    src: "/css/assets/crowns/first_time_tie_crown_2_people.png",
    alt: "Crown for a first-time winner in a two-person tie",
  }),
});

export function getCrownInfo(crownType) {
  return CROWN_INFO_BY_TYPE[crownType] || null;
}

export async function populateWeekStatsModal() {
  try {
    const res = await fetch("/api/user/league/view");
    if (!res.ok) throw new Error("Failed to load users");

    const view = await res.json();
    const users = view.users.map((user) => ({ first_name: user.firstName, last_name: user.lastName, tracks: user.tracks.map((track) => ({ wrong_pick: null, current_pick: track.currentPick.status === "VISIBLE" ? track.currentPick.teamName : null })) }));
    const stats = computeWeekStats(users);

    // Inject into the existing modal DOM
    document.getElementById("stat-most-popular").innerText = stats.mostPopular;
    document.getElementById("stat-least-popular").innerText =
      stats.leastPopular;
    document.getElementById("stat-on-the-block").innerText = stats.onTheBlock;
    document.getElementById("stat-still-perfect").innerText =
      stats.stillPerfect;
    document.getElementById("stat-most-tracks").innerText = stats.mostTracks;
  } catch (err) {
    browserLogger.error("Weekly stats error", err);
  }
}

export function bindWeekStatsModal() {
  const modalEl = document.getElementById("weekStatsModal");
  if (!modalEl) return;

  modalEl.addEventListener("show.bs.modal", populateWeekStatsModal);
}
