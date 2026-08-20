import {
  closeCurrentWeek,
  inspectAdminTrack,
  logoutAdmin,
  overrideGameResult,
  resetCurrentPicks,
  assignCurrentPick,
  replaceCurrentPick,
  reactivateTrack,
  resetPlayoffPickPools,
  correctHistoricalPick,
  reconcilePickOutcomes,
  rebuildTrackProjections,
  undoAdminAction,
  completeLeagueSeason,
  rolloverLeagueSeason,
} from "../modules/admin-management.js";
import { initializeAdminWorkflows } from "../modules/admin-workflows.js";

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

const seasonStatus = document.getElementById("seasonLifecycleStatus");
document.getElementById("completeSeasonForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const winnerTrackIds = String(document.getElementById("winningTrackIds")?.value || "").split(",").map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value > 0);
    const note = document.getElementById("completeSeasonNote")?.value.trim();
    const result = await completeLeagueSeason(winnerTrackIds, { note });
    if (result) { seasonStatus.textContent = "League Season completed and wins recorded."; event.target.reset(); }
  } catch (error) { seasonStatus.textContent = error.message || "Unable to complete the League Season."; }
});

document.getElementById("rolloverSeasonForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const targetYear = document.getElementById("rolloverTargetYear")?.value;
    const note = document.getElementById("rolloverNote")?.value.trim();
    const result = await rolloverLeagueSeason(targetYear, { note });
    if (result) { seasonStatus.textContent = `Rollover complete. ${targetYear} is ready at Week 0.`; event.target.reset(); }
  } catch (error) { seasonStatus.textContent = error.message || "Unable to roll over the League Season."; }
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
  const correctionNote = document.getElementById("buybackCorrectionNote")?.value;
  await runRepair(() => reactivateTrack({ trackId: repairTrackId(), paymentConfirmed, correctionNote }), "Track corrected; its factual wrong Pick remains used and buyback decision history was unchanged.");
});

async function loadBuybacks(view = "pending") {
  const response = await fetch(`/api/admin/buybacks?view=${view}`);
  const target = document.getElementById("buybackQueue");
  if (!response.ok) { target.textContent = (await response.json()).message || "Buyback queue unavailable"; return; }
  const payload = await response.json();
  const decisions = Array.isArray(payload.decisions) ? payload.decisions : [];
  target.replaceChildren(...decisions.map((decision) => {
    const section = document.createElement("section");
    section.className = "border rounded p-3 mb-2";
    const heading = document.createElement("h3"); heading.className = "h5"; heading.textContent = `${decision.user.displayName} (${decision.user.username}) — ${decision.status}`;
    const preseason = decision.schedulePhase === "PRESEASON";
    const pickLabel = preseason ? "Eliminating Pick" : "Week 1 Pick";
    const summary = document.createElement("p"); summary.textContent = decision.tracks.map((track) => `Track ${track.trackId} — ${pickLabel}: ${track.weekOnePick}`).join("; ") || "No requested Tracks";
    section.append(heading, summary);
    if (decision.status === "PENDING_USER_REQUEST") {
      const choices = document.createElement("fieldset"); const legend = document.createElement("legend"); legend.className = "h6"; legend.textContent = "$10 each — select only Tracks with confirmed external payment"; choices.append(legend);
      for (const [index, track] of decision.tracks.entries()) {
        const row = document.createElement("div"); row.className = "form-check mb-2";
        const input = document.createElement("input"); input.type = "checkbox"; input.className = "form-check-input admin-buyback-track"; input.id = `pendingBuyback${decision.id}Track${track.trackId}`; input.value = track.trackId;
        const label = document.createElement("label"); label.className = "form-check-label"; label.htmlFor = input.id; label.textContent = `Requested Track ${index + 1} — ${pickLabel}: ${track.weekOnePick}`;
        row.append(input, label); choices.append(row);
      }
      const paymentRow = document.createElement("div"); paymentRow.className = "form-check mb-3";
      const payment = document.createElement("input"); payment.type = "checkbox"; payment.className = "form-check-input admin-buyback-payment"; payment.id = `pendingBuyback${decision.id}Payment`;
      const paymentLabel = document.createElement("label"); paymentLabel.className = "form-check-label"; paymentLabel.htmlFor = payment.id; paymentLabel.textContent = "External payment confirmed for every selected Track";
      paymentRow.append(payment, paymentLabel); choices.append(paymentRow);
      section.append(choices);
      const complete = document.createElement("button"); complete.className = "btn btn-success me-2"; complete.textContent = "Complete selected paid subset";
      complete.addEventListener("click", async () => { const fulfilledTrackIds = [...section.querySelectorAll(".admin-buyback-track:checked")].map((input) => Number(input.value)); const paymentConfirmed = section.querySelector(".admin-buyback-payment").checked; if (!paymentConfirmed || !fulfilledTrackIds.length || !window.confirm(`Reactivate ${fulfilledTrackIds.map((id) => `Track ${id}`).join(", ")} at $10 each and close every other requested Track as unfulfilled?`)) return; await fetch(`/api/admin/buybacks/${decision.id}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stateVersion: decision.stateVersion, fulfilledTrackIds, paymentConfirmed }) }); await loadBuybacks(); });
      const cancel = document.createElement("button"); cancel.className = "btn btn-danger"; cancel.textContent = "Cancel request";
      cancel.addEventListener("click", async () => { if (!window.confirm(`Cancel this request, reactivate no Tracks, and permanently close the User's ${preseason ? "preseason" : "Week 2"} buyback decision?`)) return; await fetch(`/api/admin/buybacks/${decision.id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stateVersion: decision.stateVersion }) }); await loadBuybacks(); });
      section.append(complete, cancel);
    } else if (decision.status === "ELIGIBLE") {
      const choices = document.createElement("fieldset"); const legend = document.createElement("legend"); legend.className = "h6"; legend.textContent = "Select Tracks with confirmed external payment"; choices.append(legend);
      for (const [index, track] of decision.tracks.entries()) {
        const row = document.createElement("div"); row.className = "form-check mb-2";
        const input = document.createElement("input"); input.type = "checkbox"; input.className = "form-check-input admin-buyback-track"; input.id = `eligibleBuyback${decision.id}Track${track.trackId}`; input.value = track.trackId;
        const label = document.createElement("label"); label.className = "form-check-label"; label.htmlFor = input.id; label.textContent = `Eligible Track ${index + 1}${track.weekOnePick ? ` — ${pickLabel}: ${track.weekOnePick}` : ""}`;
        row.append(input, label); choices.append(row);
      }
      const paymentRow = document.createElement("div"); paymentRow.className = "form-check mb-3";
      const payment = document.createElement("input"); payment.type = "checkbox"; payment.className = "form-check-input admin-buyback-payment"; payment.id = `eligibleBuyback${decision.id}Payment`;
      const paymentLabel = document.createElement("label"); paymentLabel.className = "form-check-label"; paymentLabel.htmlFor = payment.id; paymentLabel.textContent = "External payment confirmed for every selected Track";
      paymentRow.append(payment, paymentLabel); choices.append(paymentRow);
      const complete = document.createElement("button"); complete.className = "btn btn-warning"; complete.type = "button"; complete.textContent = "Complete selected buybacks";
      complete.addEventListener("click", async () => { const trackIds = [...section.querySelectorAll(".admin-buyback-track:checked")].map((input) => Number(input.value)); if (!payment.checked || !trackIds.length || !window.confirm(`Reactivate ${trackIds.length} selected Tracks for ${decision.user.displayName}?`)) return; const response = await fetch("/api/admin/buybacks/direct/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: decision.user.id, trackIds, stateVersion: decision.stateVersion, paymentConfirmed: true }) }); if (response.ok) await loadBuybacks("eligible"); });
      section.append(choices, complete);
    }
    return section;
  }));
}
document.getElementById("loadPendingBuybacks")?.addEventListener("click", () => loadBuybacks("pending"));
document.getElementById("loadEligibleBuybacks")?.addEventListener("click", () => loadBuybacks("eligible"));
document.getElementById("loadBuybackHistory")?.addEventListener("click", () => loadBuybacks("history"));
loadBuybacks();
document.getElementById("directBuybackForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = { userId: Number(document.getElementById("directBuybackUserId").value), trackIds: document.getElementById("directBuybackTrackIds").value.split(",").map((value) => Number(value.trim())), stateVersion: Number(document.getElementById("directBuybackVersion").value), paymentConfirmed: document.getElementById("directBuybackPayment").checked };
  if (!window.confirm(`Reactivate ${body.trackIds.map((id) => `Track ${id}`).join(", ")} for User ${body.userId} at $10 each and suppress the remaining offer?`)) return;
  const response = await fetch("/api/admin/buybacks/direct/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) { document.getElementById("buybackQueue").textContent = (await response.json()).message || "Direct buyback failed"; return; }
  await loadBuybacks();
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

document.getElementById("historicalPickForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const pickId = Number(document.getElementById("historicalPickId")?.value);
  const teamName = document.getElementById("historicalTeamName")?.value.trim();
  await runRepair(() => correctHistoricalPick({ pickId, teamName }), "Historical Pick and Track projections corrected.");
});

document.getElementById("reconcileWeekForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const week = Number(document.getElementById("reconcileWeek")?.value);
  const pickIds = String(document.getElementById("reconcilePickIds")?.value || "").split(",").map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value > 0);
  const scope = pickIds.length ? "SELECTED" : "ALL";
  const confirmationPhrase = document.getElementById("reconcilePhrase")?.value;
  await runRepair(() => reconcilePickOutcomes({ scope, week, ...(pickIds.length ? { pickIds } : {}) }, { confirmationPhrase }), "Closed-week Pick outcomes reconciled.");
});

document.getElementById("rebuildTracksForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const selected = document.getElementById("rebuildSelectedTrack")?.checked === true;
  const confirmationPhrase = document.getElementById("rebuildPhrase")?.value;
  await runRepair(() => rebuildTrackProjections(selected ? { scope: "SELECTED", trackIds: [repairTrackId()] } : { scope: "ALL" }, { confirmationPhrase }), "Inconsistent Track projections rebuilt.");
});

document.getElementById("undoRepairForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const operationId = Number(document.getElementById("undoOperationId")?.value);
  await runRepair(() => undoAdminAction(operationId), "Eligible repair operation undone.");
});

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  try {
    await logoutAdmin();
    location.href = "/index.html";
  } catch (_error) {
    alert("Unable to log out. Please try again.");
  }
});
initializeAdminWorkflows().catch(() => {
  document.getElementById("adminHome").insertAdjacentHTML("beforeend", '<p role="alert">Unable to load admin data. Refresh and try again.</p>');
});
