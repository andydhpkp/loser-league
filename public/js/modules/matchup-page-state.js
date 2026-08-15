const LOADING_MESSAGE = "Loading this week's matchups…";
const ERROR_MESSAGE = "Unable to load this week's matchups. Please retry or refresh the page.";

function stateRegion() {
  let region = document.getElementById("matchupPageState");
  if (region) return region;

  region = document.createElement("section");
  region.id = "matchupPageState";
  region.className = "matchup-page-state";
  (document.querySelector("main") || document.body).prepend(region);
  return region;
}

export function clearMatchupOutput() {
  document.getElementById("gameMatchups")?.replaceChildren();
  document.getElementById("submitPicksBtn")?.remove();
  document.getElementById("matchupWeek")?.remove();
  const buybackGate = document.getElementById("buybackGateBanner");
  if (buybackGate) buybackGate.hidden = true;
}

export function showMatchupLoading() {
  clearMatchupOutput();
  const region = stateRegion();
  region.className = "matchup-page-state";
  region.setAttribute("role", "status");
  region.setAttribute("aria-live", "polite");
  region.setAttribute("aria-atomic", "true");
  region.replaceChildren();

  const spinner = document.createElement("span");
  spinner.className = "spinner-border matchup-loading-spinner";
  spinner.setAttribute("aria-hidden", "true");
  const message = document.createElement("span");
  message.textContent = LOADING_MESSAGE;
  region.append(spinner, message);
  document.getElementById("games")?.setAttribute("data-matchup-state", "loading");
}

export function showMatchupError(onRetry) {
  clearMatchupOutput();
  const region = stateRegion();
  region.className = "matchup-page-state alert alert-danger";
  region.setAttribute("role", "alert");
  region.setAttribute("aria-live", "assertive");
  region.setAttribute("aria-atomic", "true");
  region.replaceChildren();

  const message = document.createElement("p");
  message.textContent = ERROR_MESSAGE;
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "btn btn-primary";
  retry.textContent = "Retry";
  retry.addEventListener("click", onRetry, { once: true });
  region.append(message, retry);
  document.getElementById("games")?.setAttribute("data-matchup-state", "error");
}

export function showMatchupEmpty(message) {
  clearMatchupOutput();
  const region = stateRegion();
  region.className = "matchup-page-state alert alert-info";
  region.setAttribute("role", "status");
  region.setAttribute("aria-live", "polite");
  region.setAttribute("aria-atomic", "true");
  region.textContent = message;
  document.getElementById("games")?.setAttribute("data-matchup-state", "empty");
}

export function showMatchupReady() {
  const week = document.getElementById("matchupWeek");
  if (week) week.hidden = false;
  stateRegion().remove();
  document.getElementById("games")?.setAttribute("data-matchup-state", "ready");
}
