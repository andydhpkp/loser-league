import {
  closeCurrentWeek,
  displayUsers,
  logoutAdmin,
  overrideGameResult,
} from "../modules/admin-management.js";

const lifecycleStatus = document.getElementById("weeklyLifecycleStatus");
document.getElementById("officialResultForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await overrideGameResult({
      homeTeam: document.getElementById("overrideHomeTeam")?.value.trim(),
      awayTeam: document.getElementById("overrideAwayTeam")?.value.trim(),
      homeScore: Number(document.getElementById("overrideHomeScore")?.value),
      awayScore: Number(document.getElementById("overrideAwayScore")?.value),
      explanation: document.getElementById("overrideExplanation")?.value.trim(),
      sourceUrl: document.getElementById("overrideSourceUrl")?.value.trim(),
    });
    lifecycleStatus.textContent = "Official result recorded; weekly closure will be reevaluated.";
    event.target.reset();
  } catch (error) {
    lifecycleStatus.textContent = error.message || "Unable to record official result.";
  }
});

document.getElementById("manualCloseForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const note = document.getElementById("manualCloseNote")?.value.trim();
    const result = await closeCurrentWeek(note);
    if (result) {
      lifecycleStatus.textContent = "Current week closed.";
      event.target.reset();
    }
  } catch (error) {
    lifecycleStatus.textContent = error.message || "Unable to close the current week.";
  }
});

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  try {
    await logoutAdmin();
    location.href = "/index.html";
  } catch (_error) {
    alert("Unable to log out. Please try again.");
  }
});
displayUsers();
