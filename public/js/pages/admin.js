import {
  closeCurrentWeek,
  displayUsers,
  inspectAdminTrack,
  logoutAdmin,
  overrideGameResult,
  resetCurrentPicks,
  assignCurrentPick,
  replaceCurrentPick,
  reactivateTrack,
  resetPlayoffPickPools,
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

const repairStatus = document.getElementById("guidedRepairStatus");
const repairTrackId = () => Number(document.getElementById("repairTrackId")?.value);
const runRepair = async (work, success) => {
  repairStatus.textContent = "";
  try {
    const result = await work();
    if (result) repairStatus.textContent = success;
  } catch (error) {
    repairStatus.textContent = error.message || "Unable to complete repair.";
  }
};

document.getElementById("trackInspectorForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await runRepair(async () => {
    const result = await inspectAdminTrack(repairTrackId());
    document.getElementById("trackInspectorResult").textContent = JSON.stringify(result, null, 2);
    return result;
  }, "Track inspection loaded.");
});

document.getElementById("currentPickRepairForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const action = event.submitter?.value;
  const trackId = repairTrackId();
  const teamName = document.getElementById("repairTeamName")?.value.trim();
  await runRepair(() => {
    if (action === "assign") return assignCurrentPick({ trackId, teamName });
    if (action === "replace") return replaceCurrentPick({ trackId, teamName });
    return resetCurrentPicks({ scope: "SELECTED", trackIds: [trackId] });
  }, "Current Pick repair completed.");
});

document.getElementById("buybackRepairForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const paymentConfirmed = document.getElementById("buybackPaymentConfirmed")?.checked === true;
  await runRepair(() => reactivateTrack({ trackId: repairTrackId(), paymentConfirmed }), "Track reactivated; its factual wrong Pick remains used.");
});

document.getElementById("resetAllPicksForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const confirmationPhrase = document.getElementById("resetAllPhrase")?.value;
  await runRepair(() => resetCurrentPicks({ scope: "ALL" }, { confirmationPhrase }), "Every active Track's pending current Pick was reset.");
});

document.getElementById("playoffResetForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const confirmationPhrase = document.getElementById("playoffResetPhrase")?.value;
  await runRepair(() => resetPlayoffPickPools({ confirmationPhrase }), "Playoff Pick cycle started for every Track.");
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
