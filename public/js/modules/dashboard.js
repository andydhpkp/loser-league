export function formatDeadline(timestamp, locale = undefined) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(date);
}

export function renderDashboard(document, summary) {
  const status = document.getElementById("dashboardStatus");
  const formattedDeadline = summary.deadline?.available ? formatDeadline(summary.deadline.timestamp) : null;
  status.replaceChildren();
  const heading = document.createElement("p");
  heading.textContent = `${summary.leagueSeason.year} League Season · ${summary.leagueSeason.week === 0 ? "Week 0" : `Week ${summary.leagueSeason.week}`}`;
  const deadline = document.createElement("p"); deadline.textContent = `Next Pick deadline: ${formattedDeadline || "Unavailable"}`;
  const counts = document.createElement("p"); counts.textContent = `Active Tracks: ${summary.tracks.active} · Missing Picks: ${summary.tracks.missingPicks}`;
  status.append(heading, deadline, counts);
  status.setAttribute("aria-busy", "false");
  document.getElementById("makePicksStatus").textContent = summary.makePicks.label;
}

export async function loadDashboard({ document, fetchImpl = fetch, location = window.location }) {
  const status = document.getElementById("dashboardStatus");
  const retry = document.getElementById("retryDashboard");
  retry.hidden = true; status.setAttribute("aria-busy", "true"); status.textContent = "Loading your League Season summary…";
  try {
    const response = await fetchImpl("/api/user/dashboard", { headers: { Accept: "application/json" } });
    if (response.status === 401) { location.href = "/index.html"; return; }
    if (!response.ok) throw new Error("Dashboard request failed");
    renderDashboard(document, await response.json());
  } catch (_error) {
    status.setAttribute("aria-busy", "false"); status.textContent = "We could not load your current summary. Try again."; retry.hidden = false;
  }
}
