import {
  addUserWin,
  assignCurrentPick,
  correctHistoricalPick,
  formatUserWinHistory,
  reactivateTrack,
  replaceCurrentPick,
  resetCurrentPicks,
  runAdminAction,
  undoAdminAction,
} from "./admin-management.js";
import { computeAdminStatistics, computeRiskiestPick } from "./admin-statistics.js";

const help = {
  user: {
    title: "Make Changes for a User",
    sections: [
      ["What this workflow is for", ["Use this workspace when a specific User needs help with Tracks, Picks, wins, or a buyback.", "It shows only the current League Season. Internal database IDs stay hidden."]],
      ["When to use it", ["A User paid for one or more Tracks.", "A current Pick is missing or incorrect.", "An earlier Pick in this League Season needs a factual correction.", "A valid buyback or win needs to be recorded."]],
      ["Steps", ["Search for the User by name or username.", "Select the User, then review their Track cards.", "Select the affected Track to reveal actions valid for its current state.", "Review the preview carefully before confirming any change."]],
      ["Actions", ["Add Tracks creates the entered quantity for this User in one batch.", "Add solo win and Add tied win update the User’s visible League Season win history.", "Assign current Pick fills a missing Pick; Replace current Pick changes a pending Pick; Reset current Pick removes the pending Pick so it can be chosen again.", "Correct this Pick changes an earlier current-season Pick using authoritative results and may change Track status.", "Reactivate with confirmed payment is an exceptional correction for an eliminated Track. Ordinary Week 2 buybacks belong in Manage Buybacks.", "Undo appears only for recent operations that are still safely reversible.", "Danger Zone permanently deletes a Track or User and should be used only when deletion is intentional."]],
      ["Warnings", ["Some actions are hidden when they cannot apply safely.", "Refreshing or a stale-data message means the League Season or Track changed; review the new state before trying again.", "Deletion is permanent. Do not use deletion to correct a Pick or process a buyback."]],
    ],
  },
  bulk: {
    title: "Add Tracks in Bulk",
    sections: [
      ["What this workflow is for", ["Add paid Tracks for several Users in one submission without opening each User workspace."]],
      ["When to use it", ["Use it after receiving payments in a batch and before Track enrollment closes.", "For one User, either this workflow or Add Tracks in their User workspace is appropriate."]],
      ["Steps", ["Find each paid User in the list.", "Enter the number of Tracks to add beside each User; leave everyone else blank.", "Select Add Tracks, then verify every name, quantity, and the total.", "Confirm once to create the full batch."]],
      ["What confirmation does", ["Every requested Track receives the current League Season and full starting Team pool.", "The entire submission is atomic: either every Track is created or none are.", "Quantities must be whole numbers from 1 through 100 per User."]],
      ["Warnings", ["Confirm external payment before entering quantities.", "Do not include a User twice or use this tool after enrollment closes.", "If any User or League Season state changed, no Tracks are created; refresh and review the batch."]],
    ],
  },
  league: {
    title: "Manage Week and League Season",
    sections: [
      ["What this workflow is for", ["Create the current League Season, enroll it at Week 0, start Week 1, manage official game results and week advancement, complete the League Season, then roll it into the next year."]],
      ["Routine week actions", ["Official game result override records final scores for a scheduled matchup when authoritative automated results need correction. Supply an explanation and optional source.", "Manual week advancement settles Picks and advances the week only after results are authoritative. Always provide the operational reason."]],
      ["League Season actions", ["When no League Season exists, enter its four-digit year. Confirmation creates SETUP Week 0 so Users and Tracks can be enrolled; it does not start Picks.", "Start Week 1 is a separate confirmation. It validates the year’s Week 1 schedule, requires the earliest kickoff to still be in the future, and shows the User and Track totals that will begin.", "Complete League Season requires selecting every winning Track. The system derives solo or tied User wins from those selections.", "Rollover exports recovery data, permanently removes outgoing Tracks and Picks, preserves Users and win history, and creates the explicitly entered successor year."]],
      ["Steps", ["If no season exists, enter the exact year, preview creation, and confirm SETUP Week 0.", "Add Users and paid Tracks while enrollment is open.", "When enrollment is ready, preview Start Week 1 and verify the year, schedule, User count, and Track count before confirming.", "During an ACTIVE week, choose the relevant routine action and select visible matchups or Tracks instead of entering IDs.", "Review every affected item and warning in every preview; confirm only when the displayed League Season and week are correct."]],
      ["Advanced League Repairs", ["Reset every current Pick removes all pending Picks.", "Playoff reset starts the special Week 19 Pick pool.", "Full-week reconciliation recalculates closed-week outcomes from authoritative results.", "Projection rebuild restores compatibility fields from normalized Pick history."]],
      ["Warnings", ["Advanced repairs affect many or all Tracks and require exact confirmation phrases.", "Rollover and several advanced actions are irreversible. Download and retain the rollover export.", "Never use league-wide repair tools for a problem affecting only one User or Track."]],
    ],
  },
  buybacks: {
    title: "Manage Buybacks",
    sections: [
      ["What this workflow is for", ["Resolve Week 2 Track buybacks after payment is handled outside Loser League.", "This workflow records decisions and reactivations; it does not process money."]],
      ["Queue views", ["Pending requests shows Users who requested exact Tracks. Complete only the paid subset or cancel when none will be fulfilled.", "Eligible Users supports a direct admin buyback before the User submits a request.", "Recent history is read-only evidence of completed, declined, cancelled, or expired decisions."]],
      ["Steps", ["Choose Pending requests or Eligible Users.", "Review the User and each Track’s Week 1 Pick.", "Select only Tracks with confirmed external payment.", "Check the payment-confirmed box and review the confirmation before completing."]],
      ["What confirmation does", ["Selected Tracks are reactivated while their factual Week 1 Wrong Picks remain in history and remain used.", "Unselected Tracks in a completed request are recorded unfulfilled.", "The User’s buyback decision closes and surviving active Tracks become available for Picks."]],
      ["Warnings", ["Never enter payment details or personal messages into Loser League.", "Do not use exceptional Track correction for an ordinary buyback.", "Expired, stale, already-resolved, or ineligible requests stop without partial changes; refresh the queue."]],
    ],
  },
  statistics: {
    title: "View Statistics",
    sections: [
      ["What this workflow is for", ["Review a read-only summary of current participation without opening editing controls."]],
      ["What the numbers mean", ["Users is the number of registered Users visible to Admin.", "Total Tracks counts all displayed Tracks.", "Active Tracks counts Tracks that have not been eliminated."]],
      ["How to use it", ["Open the workflow to load the latest summary.", "Return to Admin Home when finished; no confirmation or save action is required."]],
      ["Warnings", ["Statistics do not change league state.", "A zero may mean the current local database has no Users or Tracks; it is not evidence that production data was deleted.", "Use the User or Week and League Season workflows when investigating a specific issue."]],
    ],
  },
};

function renderHelpGuide(container, guide) {
  container.replaceChildren();
  for (const [headingText, items] of guide.sections) {
    const section = document.createElement("section");
    const heading = document.createElement("h3");
    heading.className = "h5";
    heading.textContent = headingText;
    const list = document.createElement(headingText === "Steps" ? "ol" : "ul");
    items.forEach((text) => { const item = document.createElement("li"); item.textContent = text; list.append(item); });
    section.append(heading, list);
    container.append(section);
  }
}

let users = [];
let selectedUserId = null;
let selectedTrackId = null;

function displayName(user) {
  return `${user.first_name || ""} ${user.last_name || ""}`.trim();
}

function userTracks(user) {
  return Array.isArray(user.tracks) ? user.tracks : Array.isArray(user.Tracks) ? user.Tracks : [];
}

async function loadUsers() {
  const response = await fetch("/api/users", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load Users");
  users = await response.json();
  return users;
}

async function loadLeagueSeasonContext() {
  const response = await fetch("/api/admin/league-season", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load League Season status");
  const context = await response.json();
  const season = context.leagueSeason;
  const create = document.getElementById("createLeagueSeasonForm");
  const start = document.getElementById("startLeagueSeasonForm");
  const enablePreseason = document.getElementById("enablePreseasonForm");
  const startRegular = document.getElementById("startRegularSeasonForm");
  const activeControlIds = ["officialResultForm", "manualCloseForm", "completeSeasonForm"];
  const activeControls = activeControlIds.map((id) => document.getElementById(id));
  const rollover = document.getElementById("rolloverSeasonForm");
  const advanced = document.querySelector("#leagueWorkflow .admin-danger-zone");
  create.hidden = Boolean(season);
  start.hidden = !(season?.state === "SETUP" && season.week === 0);
  enablePreseason.hidden = !season || season.schedulePhase === "PRESEASON" || !((season.state === "SETUP" && season.week === 0) || (season.state === "ACTIVE" && season.week === 1));
  startRegular.hidden = season?.schedulePhase !== "PRESEASON";
  const active = season?.state === "ACTIVE";
  activeControls.forEach((control) => { control.hidden = !active; });
  rollover.hidden = season?.state !== "COMPLETE";
  if (advanced) advanced.hidden = !active;
  const status = document.getElementById("leagueSeasonContextStatus");
  if (!season) status.textContent = context.unassignedTrackCount ? `${context.unassignedTrackCount} legacy Tracks must be handled with the guarded bootstrap command before a League Season can be created here.` : "No League Season exists. Enter its year to create SETUP Week 0.";
  else status.textContent = `${season.year} League Season — ${season.schedulePhase === "PRESEASON" ? "Preseason" : "Regular season"}, ${season.preseasonComplete ? "complete" : `Week ${season.week}`}`;
  if (active) await loadMatchups(season);
  return context;
}

async function showWorkflow(name) {
  document.getElementById("adminHome").hidden = true;
  document.querySelectorAll("[data-workflow]").forEach((section) => { section.hidden = section.dataset.workflow !== name; });
  document.getElementById("adminBottomNavigation").hidden = false;
  document.getElementById("adminBottomHelp").dataset.help = name;
  document.querySelector(`[data-workflow="${name}"] h2`)?.focus?.();
  if (name === "league") await loadLeagueSeasonContext();
}

function showHome() {
  document.getElementById("adminHome").hidden = false;
  document.querySelectorAll("[data-workflow]").forEach((section) => { section.hidden = true; });
  document.getElementById("adminBottomNavigation").hidden = true;
  document.getElementById("adminHomeHeading")?.focus?.();
}

function trackSummary(view, ordinal) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "admin-track-card";
  card.innerHTML = `<strong>Track ${ordinal}</strong><span>${view.track.active ? "Active" : "Eliminated"}</span><span>Current Pick: ${view.projections.currentPick || "Not submitted"}</span><span>Used Teams: ${view.projections.usedPicks.join(", ") || "None"}</span>`;
  return card;
}

function option(value, label) {
  const item = document.createElement("option");
  item.value = String(value);
  item.textContent = label;
  return item;
}

function renderTrackActions(target, view, ordinal) {
  selectedTrackId = view.track.id;
  target.replaceChildren();
  const heading = document.createElement("h4");
  heading.textContent = `Track ${ordinal} actions`;
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const team = document.createElement("select");
  team.className = "form-select mb-2";
  team.setAttribute("aria-label", `Valid Team for Track ${ordinal}`);
  team.append(option("", "Choose a valid Team"), ...view.eligibleCurrentWeekTeams.map((name) => option(name, name)));
  const actions = document.createElement("div");
  actions.className = "d-flex gap-2 flex-wrap mb-3";
  const run = async (work, message, { preserveTrack = true } = {}) => {
    const controls = [...target.querySelectorAll("button, select, input")];
    controls.forEach((control) => { control.disabled = true; });
    status.textContent = "Updating…";
    try {
      const result = await work();
      if (result) await renderUserWorkspace(selectedUserId, { preferredTrackId: preserveTrack ? view.track.id : null, message });
      else { status.textContent = ""; controls.forEach((control) => { control.disabled = false; }); }
    } catch (error) {
      status.textContent = error.message;
      controls.forEach((control) => { control.disabled = false; });
    }
  };
  if (view.track.active) {
    const assign = document.createElement("button");
    assign.className = "btn btn-primary";
    assign.textContent = view.projections.currentPick ? "Replace current Pick" : "Assign current Pick";
    assign.addEventListener("click", () => run(() => view.projections.currentPick
      ? replaceCurrentPick({ trackId: view.track.id, teamName: team.value })
      : assignCurrentPick({ trackId: view.track.id, teamName: team.value }), "Pick updated."));
    actions.append(assign);
    if (view.projections.currentPick) {
      const reset = document.createElement("button");
      reset.className = "btn btn-warning";
      reset.textContent = "Reset current Pick";
      reset.addEventListener("click", () => run(() => resetCurrentPicks({ scope: "SELECTED", trackIds: [view.track.id] }), "Current Pick reset."));
      actions.append(reset);
    }
  } else {
    const reactivate = document.createElement("button");
    reactivate.className = "btn btn-warning";
    reactivate.textContent = "Reactivate with confirmed payment";
    reactivate.addEventListener("click", () => {
      const correctionNote = window.prompt("Required correction note");
      if (correctionNote) run(() => reactivateTrack({ trackId: view.track.id, paymentConfirmed: true, correctionNote }), "Track reactivated.");
    });
    actions.append(reactivate);
  }
  const remove = document.createElement("button");
  remove.className = "btn btn-danger";
  remove.textContent = `Delete Track ${ordinal}`;
  remove.addEventListener("click", () => run(() => runAdminAction("DELETE_TRACK", { trackId: view.track.id }), `Track ${ordinal} deleted.`, { preserveTrack: false }));
  actions.append(remove);

  const history = document.createElement("section");
  const historyHeading = document.createElement("h5");
  historyHeading.textContent = "Current-season Pick history";
  history.append(historyHeading);
  view.picks.forEach((pick) => {
    const row = document.createElement("div");
    row.className = "admin-pick-row";
    row.innerHTML = `<span>Week ${pick.week}: ${pick.teamName} — ${pick.outcome.replaceAll("_", " ")}</span>`;
    const correct = document.createElement("button");
    correct.className = "btn btn-sm btn-warning";
    correct.textContent = "Correct this Pick";
    correct.addEventListener("click", () => {
      const select = document.createElement("select");
      select.className = "form-select mt-2";
      select.append(option("", "Choose actual Team"), ...view.projections.availablePicks.concat(view.projections.usedPicks).filter((name, index, all) => all.indexOf(name) === index).sort().map((name) => option(name, name)));
      const save = document.createElement("button");
      save.className = "btn btn-warning mt-2";
      save.textContent = "Correct this Pick";
      save.addEventListener("click", () => run(() => correctHistoricalPick({ pickId: pick.id, teamName: select.value }), "Historical Pick corrected."));
      row.append(select, save);
      correct.remove();
    });
    row.append(correct);
    history.append(row);
  });

  const undoable = view.recentOperations.filter((operation) => operation.undoable);
  if (undoable.length) {
    const operations = document.createElement("section");
    operations.innerHTML = "<h5>Recent actions eligible for undo</h5>";
    undoable.forEach((operation) => {
      const button = document.createElement("button");
      button.className = "btn btn-warning d-block mb-2";
      button.textContent = `Undo ${operation.description}`;
      button.addEventListener("click", () => run(() => undoAdminAction(operation.id), "Action undone."));
      operations.append(button);
    });
    history.append(operations);
  }
  target.append(heading, team, actions, history, status);
}

async function loadUserWorkspace(userId) {
  const response = await fetch(`/api/admin/users/${Number(userId)}/workspace`, { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load User workspace");
  return response.json();
}

async function renderUserWorkspace(userId, { preferredTrackId = null, message = "" } = {}) {
  selectedUserId = Number(userId);
  selectedTrackId = preferredTrackId;
  const { user, tracks: inspected } = await loadUserWorkspace(selectedUserId);
  const userIndex = users.findIndex((item) => item.id === user.id);
  const userSummary = { ...users[userIndex], ...user, tracks: inspected.map((view) => ({
    id: view.track.id,
    league_season_id: view.leagueSeason.id,
    current_pick: view.projections.currentPick,
    wrong_pick: view.projections.wrongPick,
    eliminated_by_pick_id: view.track.eliminatingPickId,
  })) };
  if (userIndex >= 0) users[userIndex] = userSummary;
  renderUserList();
  const workspace = document.getElementById("adminUserWorkspace");
  workspace.innerHTML = `<button class="btn btn-link admin-mobile-back" type="button">← Back to Users</button><h3>${displayName(userSummary)} <small>@${userSummary.username}</small></h3><p id="adminUserWorkspaceStatus" role="status" aria-live="polite">${message}</p>`;
  workspace.querySelector(".admin-mobile-back").addEventListener("click", () => document.getElementById("adminUserPicker").classList.remove("admin-picker-hidden"));
  const addForm = document.createElement("form");
  addForm.className = "admin-inline-form mb-3";
  addForm.innerHTML = `<label>Track quantity <input class="form-control" inputmode="numeric" pattern="[0-9]+" required /></label><button class="btn btn-primary">Add Tracks</button>`;
  addForm.querySelector("input").addEventListener("input", (event) => { addForm.querySelector("button").textContent = `Add ${event.target.value || ""} Tracks`.replace("  ", " "); });
  addForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const quantity = Number(addForm.querySelector("input").value);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return window.alert("Enter a whole number from 1 through 100");
    if (!window.confirm(`Add ${quantity} Tracks for ${displayName(userSummary)}?`)) return;
    const controls = [...addForm.querySelectorAll("button, input")]; controls.forEach((control) => { control.disabled = true; });
    document.getElementById("adminUserWorkspaceStatus").textContent = "Updating…";
    const response = await fetch("/api/admin/tracks/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ additions: [{ userId: user.id, quantity }] }) });
    if (!response.ok) { controls.forEach((control) => { control.disabled = false; }); document.getElementById("adminUserWorkspaceStatus").textContent = (await response.json()).message || "Unable to add Tracks"; return; }
    await renderUserWorkspace(user.id, { message: `${quantity} Tracks added.` });
  });
  const wins = document.createElement("section");
  wins.className = "mb-3";
  const winHistory = document.createElement("p"); winHistory.textContent = `Win history: ${formatUserWinHistory(userSummary.user_record)}`;
  const crownType = document.createElement("p"); crownType.textContent = `Crown type: ${userSummary.crown_type || "none"}`;
  const yearLabel = document.createElement("label"); yearLabel.className = "form-label"; yearLabel.textContent = "League Season year";
  const yearInput = document.createElement("input"); yearInput.className = "form-control mb-2"; yearInput.type = "text"; yearInput.inputMode = "numeric"; yearInput.pattern = "[0-9]{4}"; yearInput.maxLength = 4; yearLabel.append(yearInput);
  const winButtons = document.createElement("div"); winButtons.className = "d-flex gap-2";
  const winStatus = document.createElement("p"); winStatus.setAttribute("role", "status");
  for (const [label, tied] of [["Add solo win", false], ["Add tied win", true]]) {
    const button = document.createElement("button"); button.className = "btn btn-primary"; button.textContent = label;
    button.addEventListener("click", async () => {
      try {
        button.disabled = true; winStatus.textContent = "Updating…";
        const result = await addUserWin({ userId: userSummary.id, displayName: displayName(userSummary), year: yearInput.value, wonWithTie: tied });
        if (!result) { button.disabled = false; winStatus.textContent = ""; return; }
        await renderUserWorkspace(userSummary.id, { message: "Win recorded." });
      } catch (error) { button.disabled = false; winStatus.textContent = error.message; }
    });
    winButtons.append(button);
  }
  wins.append(winHistory, crownType, yearLabel, winButtons, winStatus);
  const buyback = document.createElement("button");
  buyback.className = "btn btn-warning mb-3";
  buyback.textContent = "Manage this User's buyback";
  buyback.addEventListener("click", () => showWorkflow("buybacks"));
  workspace.append(addForm, wins, buyback);
  if (!inspected.length) workspace.insertAdjacentHTML("beforeend", "<p>No Tracks in the current League Season.</p>");
  const cards = document.createElement("div"); cards.className = "admin-track-grid";
  const detail = document.createElement("section"); detail.className = "admin-track-actions";
  const current = inspected.filter((view) => ["SETUP", "ACTIVE"].includes(view.leagueSeason.state));
  current.forEach((view, index) => { const card = trackSummary(view, index + 1); card.dataset.trackId = view.track.id; card.addEventListener("click", () => renderTrackActions(detail, view, index + 1)); cards.append(card); });
  const danger = document.createElement("details");
  danger.className = "admin-danger-zone mt-4";
  danger.innerHTML = "<summary>Danger Zone</summary><p>Select a Track above before deleting it. User deletion permanently removes the User and every owned Track.</p>";
  const deleteUser = document.createElement("button"); deleteUser.className = "btn btn-danger"; deleteUser.textContent = `Delete ${displayName(userSummary)}`;
  deleteUser.addEventListener("click", async () => {
    deleteUser.disabled = true; document.getElementById("adminUserWorkspaceStatus").textContent = "Updating…";
    try {
      const result = await runAdminAction("DELETE_USER", { userId: userSummary.id });
      if (!result) { deleteUser.disabled = false; document.getElementById("adminUserWorkspaceStatus").textContent = ""; return; }
      selectedUserId = null; selectedTrackId = null; await refreshUsers();
      workspace.innerHTML = '<p role="status" aria-live="polite">User deleted.</p>';
      document.getElementById("adminUserPicker").classList.remove("admin-picker-hidden");
    } catch (error) { deleteUser.disabled = false; document.getElementById("adminUserWorkspaceStatus").textContent = error.message; }
  }); danger.append(deleteUser);
  workspace.append(cards, detail, danger);
  document.getElementById("adminUserPicker").classList.add("admin-picker-hidden");
  workspace.focus();
  if (preferredTrackId) cards.querySelector(`[data-track-id="${preferredTrackId}"]`)?.click();
}

function renderUserList() {
  const query = document.getElementById("adminUserSearch").value.trim().toLowerCase();
  const list = document.getElementById("adminUserList");
  list.replaceChildren(...users.filter((user) => `${displayName(user)} ${user.username}`.toLowerCase().includes(query)).map((user) => {
    const button = document.createElement("button");
    button.type = "button"; button.className = "admin-user-choice";
    const tracks = userTracks(user); const active = tracks.filter((track) => !track.eliminated_by_pick_id && !track.wrong_pick).length;
    button.innerHTML = `<strong>${displayName(user)}</strong><span>@${user.username}</span><span>${active} active / ${tracks.length} total Tracks</span>`;
    button.addEventListener("click", () => renderUserWorkspace(user.id));
    return button;
  }));
}

function renderBulkUsers() {
  const target = document.getElementById("bulkTrackUsers");
  target.replaceChildren(...users.map((user) => {
    const label = document.createElement("label"); label.className = "admin-bulk-user";
    label.innerHTML = `<span><strong>${displayName(user)}</strong><small>@${user.username}</small></span><input class="form-control" inputmode="numeric" pattern="[0-9]*" placeholder="0" aria-label="Tracks for ${displayName(user)}" data-user-id="${user.id}" />`;
    return label;
  }));
}

function renderWinnerChoices() {
  const target = document.getElementById("winningTrackChoices");
  target.replaceChildren(...users.flatMap((user) => userTracks(user).map((track, index) => {
    const label = document.createElement("label"); label.className = "form-check d-block";
    label.innerHTML = `<input class="form-check-input winning-track" type="checkbox" value="${track.id}" /> ${displayName(user)} — Track ${index + 1}`;
    return label;
  })));
}

async function refreshUsers() {
  await loadUsers();
  renderUserList(); renderBulkUsers(); renderWinnerChoices();
}

let statisticsLeagueSeasonId = null;

function renderStatistics(statistics) {
  document.getElementById("statMostPopular").textContent = statistics.mostPopular;
  document.getElementById("statLeastPopular").textContent = statistics.leastPopular;
  document.getElementById("statUsersEliminated").textContent = statistics.usersEliminated;
  document.getElementById("statUsersLeft").textContent = statistics.usersLeft;
  document.getElementById("statTracksLeft").textContent = statistics.tracksLeft;
  document.getElementById("statMostTracks").textContent = statistics.usersWithMostTracks;
  document.getElementById("statLeastTracks").textContent = statistics.usersWithLeastTracks;
}

async function showStatisticsModal() {
  await refreshUsers();
  const response = await fetch("/api/admin/league-season", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load League Season status");
  const { leagueSeason } = await response.json();
  statisticsLeagueSeasonId = leagueSeason?.id ?? null;
  renderStatistics(computeAdminStatistics(users, statisticsLeagueSeasonId));
  document.getElementById("statRiskiestRow").hidden = true;
  document.getElementById("statisticsOddsStatus").textContent = "";
  window.bootstrap.Modal.getOrCreateInstance(document.getElementById("weeklyStatisticsModal")).show();
}

async function reloadStatisticsOdds() {
  const status = document.getElementById("statisticsOddsStatus");
  const button = document.getElementById("reloadStatisticsOdds");
  status.textContent = "Loading game odds…";
  button.disabled = true;
  try {
    const response = await fetch("/api/proxy/nfl-odds", { cache: "no-store" });
    if (!response.ok) throw new Error("Odds unavailable");
    const result = computeRiskiestPick(users, statisticsLeagueSeasonId, await response.json());
    if (!result) throw new Error("Odds unavailable — no current Picks matched the game odds.");
    document.getElementById("statRiskiestPick").textContent = `${result.users.join(", ")}: ${result.team} (Spread: ${result.spread})`;
    document.getElementById("statRiskiestRow").hidden = false;
    status.textContent = "Game odds updated.";
  } catch (error) {
    status.textContent = error.message?.startsWith("Odds unavailable") ? error.message : "Odds unavailable.";
  } finally {
    button.disabled = false;
  }
}

async function loadMatchups(season) {
  try {
    const query = new globalThis.URLSearchParams({ year: String(season.year), week: String(season.week) });
    if (season.schedulePhase === "PRESEASON") query.set("seasonType", "preseason");
    const response = await fetch(`/api/nfl/schedule?${query}`, { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    const games = Object.values(payload.content?.schedule || {}).flatMap((day) => day.games || []);
    const select = document.getElementById("overrideMatchup");
    select.replaceChildren(option("", "Select a matchup"));
    games.forEach((game) => {
      const competitors = game.competitions?.[0]?.competitors || [];
      const home = competitors.find((team) => team.homeAway === "home")?.team?.displayName;
      const away = competitors.find((team) => team.homeAway === "away")?.team?.displayName;
      if (home && away) select.append(option(JSON.stringify({ home, away }), `${away} at ${home}`));
    });
  } catch (_error) { /* The form remains unavailable when the schedule cannot load. */ }
}

export async function initializeAdminWorkflows() {
  const helpDialog = document.getElementById("adminHelpDialog");
  let helpReturnFocus = null;
  helpDialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusable = [...helpDialog.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")]
      .filter((element) => !element.disabled && !element.hidden);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (focusable.length === 1 || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  });
  helpDialog.addEventListener("close", () => {
    helpReturnFocus?.focus();
    helpReturnFocus = null;
  });
  document.querySelectorAll("[data-open-workflow]").forEach((button) => button.addEventListener("click", async () => { await refreshUsers(); await showWorkflow(button.dataset.openWorkflow); }));
  document.getElementById("viewStatistics").addEventListener("click", async () => {
    try { await showStatisticsModal(); } catch (error) { window.alert(error.message || "Unable to load statistics"); }
  });
  document.getElementById("reloadStatisticsOdds").addEventListener("click", reloadStatisticsOdds);
  document.querySelectorAll("[data-admin-home]").forEach((button) => button.addEventListener("click", showHome));
  document.getElementById("adminUserSearch").addEventListener("input", renderUserList);
  document.querySelectorAll("[data-help]").forEach((button) => button.addEventListener("click", () => {
    const guide = help[button.dataset.help];
    document.getElementById("adminHelpTitle").textContent = guide.title;
    renderHelpGuide(document.getElementById("adminHelpBody"), guide);
    helpReturnFocus = button;
    helpDialog.showModal();
    helpDialog.querySelector(".btn-close")?.focus();
  }));
  document.getElementById("bulkTrackForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const additions = [...event.currentTarget.querySelectorAll("[data-user-id]")].map((input) => ({ userId: Number(input.dataset.userId), quantity: Number(input.value || 0), input })).filter(({ quantity }) => quantity > 0);
    if (!additions.length || additions.some(({ quantity }) => !Number.isInteger(quantity) || quantity > 100)) return window.alert("Enter whole-number quantities from 1 through 100");
    const summary = additions.map(({ userId, quantity }) => `${displayName(users.find((user) => user.id === userId))} +${quantity}`).join(", ");
    const total = additions.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById("bulkTrackPreview").textContent = `${summary}. ${total} Tracks total.`;
    if (!window.confirm(`Create ${total} Tracks? ${summary}`)) return;
    const response = await fetch("/api/admin/tracks/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ additions: additions.map(({ userId, quantity }) => ({ userId, quantity })) }) });
    const payload = await response.json();
    if (!response.ok) return window.alert(payload.message || "No Tracks were created");
    document.getElementById("bulkTrackPreview").textContent = `${payload.totalCreated} Tracks created.`;
    event.currentTarget.reset(); await refreshUsers();
  });
  document.getElementById("overrideMatchup").addEventListener("change", (event) => {
    const matchup = event.target.value ? JSON.parse(event.target.value) : { home: "", away: "" };
    document.getElementById("overrideHomeTeam").value = matchup.home;
    document.getElementById("overrideAwayTeam").value = matchup.away;
  });
  document.getElementById("completeSeasonForm").addEventListener("change", () => { document.getElementById("winningTrackIds").value = [...document.querySelectorAll(".winning-track:checked")].map((input) => input.value).join(","); });
  document.getElementById("createLeagueSeasonForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const year = Number(document.getElementById("createLeagueSeasonYear").value);
    const status = document.getElementById("leagueSeasonContextStatus");
    try { if (await runAdminAction("CREATE_LEAGUE_SEASON", { year })) await loadLeagueSeasonContext(); } catch (error) { status.textContent = error.message; }
  });
  document.getElementById("startLeagueSeasonForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const context = await loadLeagueSeasonContext();
    const status = document.getElementById("leagueSeasonContextStatus");
    try { if (await runAdminAction("START_LEAGUE_SEASON", { year: context.leagueSeason.year })) await loadLeagueSeasonContext(); } catch (error) { status.textContent = error.message; }
  });
  document.getElementById("enablePreseasonForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.getElementById("leagueSeasonContextStatus");
    try { if (await runAdminAction("ENABLE_PRESEASON", {})) await loadLeagueSeasonContext(); } catch (error) { status.textContent = error.message; }
  });
  document.getElementById("startRegularSeasonForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.getElementById("leagueSeasonContextStatus");
    try { if (await runAdminAction("START_REGULAR_SEASON", {})) await loadLeagueSeasonContext(); } catch (error) { status.textContent = error.message; }
  });
  await refreshUsers();
}
