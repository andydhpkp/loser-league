import { browserLogger } from "./logger.js";
import { computeWeekStats, sortUsersByTracksLeft } from "./modules/league-stats.js";

export { computeWeekStats, sortUsersByTracksLeft };

export function getCrownInfo(userRecord) {
  // If no user_record, no crown
  if (!userRecord || userRecord.length === 0) {
    return null;
  }

  // Calculate win statistics
  const totalWins = userRecord.filter((record) => record.won).length;
  const cleanWins = userRecord.filter(
    (record) => record.won && !record.won_with_tie
  ).length;
  const tieWins = userRecord.filter(
    (record) => record.won && record.won_with_tie
  ).length;

  // Crown logic - easily expandable for future types
  if (totalWins === 0) {
    return null; // No wins, no crown
  }

  // Current logic: if user has any tie wins, show silver crown
  if (tieWins > 0) {
    return {
      src: "/css/assets/crowns/silver-crown-1.png",
      alt: "Silver Crown - Won with tie",
      title: `${totalWins} win${
        totalWins > 1 ? "s" : ""
      } (including ${tieWins} tie${tieWins > 1 ? "s" : ""})`,
    };
  }

  // Future expandability examples (commented out for now):
  /*
  // Multiple clean wins could get gold crown
  if (cleanWins >= 3) {
    return {
      src: "/css/assets/crowns/gold-crown.png",
      alt: "Gold Crown - Multiple clean wins",
      title: `${cleanWins} clean wins`
    };
  }
  
  // Single clean win could get bronze crown
  if (cleanWins === 1) {
    return {
      src: "/css/assets/crowns/bronze-crown.png", 
      alt: "Bronze Crown - Single clean win",
      title: "1 clean win"
    };
  }
  */

  // For now, any other wins (clean wins) get no crown since we only have silver
  // In the future, this would be where you'd add other crown types
  return null;
}

export async function populateWeekStatsModal() {
  try {
    const res = await fetch("/api/users");
    if (!res.ok) throw new Error("Failed to load users");

    const users = await res.json();
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
