const dollars = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

export function buildBuybackView(buyback) {
  if (!buyback) return null;
  const preseason = buyback.schedulePhase === "PRESEASON";
  return {
    ...buyback,
    heading: buyback.status === "PENDING_USER_REQUEST" ? `${preseason ? "Preseason" : "Week 2"} buyback request pending` : buyback.status === "UNAVAILABLE" ? `${preseason ? "Preseason" : "Week 2"} buyback temporarily unavailable` : `${preseason ? "Preseason" : "Week 2"} Track buyback`,
    pickLabel: preseason ? "Eliminating Pick" : "Week 1 Pick",
    declineConfirmation: `Continue without buying back any Track? This permanently closes the ${preseason ? "preseason" : "Week 2"} offer and unlocks Picks for surviving Tracks.`,
    unitPrice: dollars(buyback.unitPriceCents),
    total: dollars(buyback.totalCents),
  };
}

function addContactActions(container, view) {
  if (view.payment) {
    const link = document.createElement("a"); link.className = "btn btn-primary me-2"; link.href = view.payment.url; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = `Pay Tate on Venmo (${view.payment.handle})`; container.append(link);
  }
  for (const contact of view.contacts || []) {
    const link = document.createElement("a"); link.className = "btn btn-outline-primary me-2"; link.href = contact.smsUrl; link.textContent = `Text ${contact.name} for help`; container.append(link);
  }
}

export function renderBuyback(buyback, { fetchImpl = fetch, modalApi = window.bootstrap?.Modal } = {}) {
  const view = buildBuybackView(buyback);
  if (!view) return;
  const modalElement = document.getElementById("buybackModal");
  const banner = document.getElementById("buybackGateBanner");
  const form = document.getElementById("buybackSelectionForm");
  document.getElementById("buybackTitle").textContent = view.heading;
  banner.firstChild.textContent = `Resolve your ${view.schedulePhase === "PRESEASON" ? "preseason" : "Week 2"} buyback decision before making Picks. `;
  banner.hidden = !view.pickBlocked;
  document.getElementById("reopenBuyback").onclick = () => modalApi.getOrCreateInstance(modalElement).show();
  form.replaceChildren(...view.tracks.map((track) => {
    const wrapper = document.createElement("div"); wrapper.className = "form-check";
    const input = document.createElement("input"); input.type = "checkbox"; input.className = "form-check-input buyback-track"; input.id = `buybackTrack${track.trackId}`; input.value = String(track.trackId); input.disabled = view.status !== "ELIGIBLE";
    const label = document.createElement("label"); label.className = "form-check-label"; label.htmlFor = input.id; label.textContent = `Track ${track.trackId} — ${view.pickLabel}: ${track.weekOnePick}${track.resolution ? ` (${track.resolution.toLowerCase()})` : ""}`;
    wrapper.append(input, label); return wrapper;
  }));
  const total = document.getElementById("buybackTotal");
  const updateTotal = () => { const count = view.status === "ELIGIBLE" ? form.querySelectorAll(".buyback-track:checked").length : view.selectedCount; total.textContent = `${view.unitPrice} × ${count} = ${dollars(count * view.unitPriceCents)}`; };
  form.addEventListener("change", updateTotal); updateTotal();
  const actions = document.getElementById("buybackContactActions"); actions.replaceChildren(); addContactActions(actions, view);
  const request = document.getElementById("requestBuyback"); const decline = document.getElementById("declineBuyback");
  request.hidden = view.status !== "ELIGIBLE"; decline.hidden = view.status !== "ELIGIBLE";
  request.onclick = () => {
    const selected = [...form.querySelectorAll(".buyback-track:checked")].map((input) => Number(input.value));
    const error = document.getElementById("buybackError");
    if (!selected.length) { error.textContent = "Select at least one eligible Track."; error.hidden = false; return; }
    document.getElementById("buybackConfirmationSummary").textContent = `${selected.map((id) => `Track ${id}`).join(", ")}; ${view.unitPrice} each; ${dollars(selected.length * view.unitPriceCents)} total. Payment is manual and Picks stay blocked until admin resolution.`;
    document.getElementById("buybackConfirmation").hidden = false;
    document.getElementById("confirmBuybackRequest").onclick = async () => mutate("request", { trackIds: selected });
  };
  decline.onclick = () => {
    document.getElementById("buybackConfirmationSummary").textContent = view.declineConfirmation;
    document.getElementById("buybackConfirmation").hidden = false;
    document.getElementById("confirmBuybackRequest").onclick = async () => mutate("decline", {});
  };
  async function mutate(action, body) {
    const response = await fetchImpl(`/api/user/league/buyback/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, stateVersion: view.stateVersion }) });
    if (!response.ok) { const payload = await response.json(); const error = document.getElementById("buybackError"); error.textContent = payload.message || "Buyback decision failed"; error.hidden = false; return; }
    window.location.reload();
  }
  if (["ELIGIBLE", "PENDING_USER_REQUEST"].includes(view.status)) modalApi.getOrCreateInstance(modalElement).show();
}
