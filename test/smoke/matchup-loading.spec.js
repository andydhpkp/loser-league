const { expect, test } = require("@playwright/test");

test("profile shows one accessible loading state while Track state is pending", async ({ page }) => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  await page.route("**/api/user/league/submission", async (route) => {
    await pending;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      leagueSeason: { id: 1, year: 2026, week: 1, state: "ACTIVE" }, tracks: [],
    }) });
  });

  const navigation = page.goto("/profile.html");
  const status = page.getByRole("status", { name: "" });
  await expect(status).toContainText("Loading this week's matchups…");
  await expect(page.locator(".matchup-loading-spinner")).toHaveCount(1);
  await expect(page.locator(".matchup-loading-spinner")).toHaveAttribute("aria-hidden", "true");
  release();
  await navigation;
  await expect(page.getByText("No active Tracks are available.")).toBeVisible();
});

test("failed loading exposes one inline error and Retry starts a fresh attempt", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/user/league/submission", async (route) => {
    attempts += 1;
    if (attempts === 1) return route.fulfill({ status: 500, body: "failed" });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      leagueSeason: { id: 1, year: 2026, week: 1, state: "ACTIVE" }, tracks: [],
    }) });
  });
  await page.route("**/api/user/league/support", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"contacts":[]}' }));

  await page.goto("/profile.html");
  await expect(page.getByRole("alert")).toContainText("Unable to load this week's matchups. Please retry or refresh the page.");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("No active Tracks are available.")).toBeVisible();
  expect(attempts).toBeGreaterThanOrEqual(2);
  await expect(page.locator("#matchupPageState")).toHaveCount(1);
});

test("spinner remains until schedule, records, rendering, and logos are ready", async ({ page }) => {
  let releaseRecords;
  const recordsPending = new Promise((resolve) => { releaseRecords = resolve; });
  const logo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10'%3E%3Crect width='10' height='10'/%3E%3C/svg%3E";
  await page.route("**/api/user/league/submission", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({
      leagueSeason: { id: 1, year: 2026, week: 1, state: "ACTIVE" }, submissionOpen: false,
      tracks: [{ id: 4, stateVersion: 0, status: "NOT_SUBMITTED", usedTeamNames: [] }],
    }),
  }));
  await page.route("**/api/nfl/teams", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ sports: [{ leagues: [{ teams: [
      { team: { displayName: "Bears", slug: "bears", logos: [{ href: logo }] } },
      { team: { displayName: "Packers", slug: "packers", logos: [{ href: logo }] } },
    ] }] }] }),
  }));
  await page.route("**/api/proxy/nfl", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify([
      { RoundNumber: 1, DateUtc: "2026-09-10T00:00:00Z", HomeTeam: "Bears", AwayTeam: "Packers" },
    ]),
  }));
  await page.route("**/api/nfl/schedule?*", async (route) => {
    await recordsPending;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: { schedule: {
      day: { games: [{ date: "2026-09-10T00:00:00Z", competitions: [{ competitors: [
        { homeAway: "home", team: { displayName: "Bears" }, records: [{ summary: "1-0" }] },
        { homeAway: "away", team: { displayName: "Packers" }, records: [{ summary: "0-1" }] },
      ] }] }] },
    } } }) });
  });

  await page.goto("/profile.html");
  await expect(page.getByText("Loading this week's matchups…")).toBeVisible();
  await expect(page.locator(".track-dropdown")).toBeHidden();
  releaseRecords();
  await expect(page.getByText("Pick submission is closed")).toBeVisible();
  await expect(page.locator("#matchupPageState")).toHaveCount(0);
  await expect(page.locator(".record").first()).toHaveText("(1 - 0)");
});

test("loading layout remains centered at narrow width and stops motion when requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.route("**/api/user/league/submission", () => new Promise(() => {}));
  await page.goto("/profile.html", { waitUntil: "domcontentloaded" });
  const state = page.locator("#matchupPageState");
  await expect(state).toHaveCSS("text-align", "center");
  await expect(page.locator(".matchup-loading-spinner")).toHaveCSS("animation-name", "none");
  const box = await state.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
});

test("an authoritative week without matchups ends in a valid empty state", async ({ page }) => {
  await page.route("**/api/user/league/submission", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({
      leagueSeason: { id: 1, year: 2026, week: 4, state: "ACTIVE" }, submissionOpen: true,
      tracks: [{ id: 8, stateVersion: 0, status: "NOT_SUBMITTED", usedTeamNames: [] }],
    }),
  }));
  await page.route("**/api/nfl/teams", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: '{"sports":[{"leagues":[{"teams":[]}]}]}',
  }));
  await page.route("**/api/nfl/schedule?*", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: '{"content":{"schedule":{}}}',
  }));

  await page.goto("/profile.html");
  await expect(page.getByRole("status")).toHaveText("No matchups are available for Week 4.");
  await expect(page.locator("#submitPicksBtn, .track-dropdown, .matchup-loading-spinner")).toHaveCount(0);
});

test("malformed required Team data becomes one recoverable inline error", async ({ page }) => {
  await page.route("**/api/user/league/submission", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({
      leagueSeason: { id: 1, year: 2026, week: 1, state: "ACTIVE" }, submissionOpen: true,
      tracks: [{ id: 8, stateVersion: 0, status: "NOT_SUBMITTED", usedTeamNames: [] }],
    }),
  }));
  await page.route("**/api/nfl/teams", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route("**/api/proxy/nfl", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([
    { RoundNumber: 1, DateUtc: "2026-09-10T00:00:00Z", HomeTeam: "Bears", AwayTeam: "Packers" },
  ]) }));

  await page.goto("/profile.html");
  await expect(page.getByRole("alert")).toContainText("Unable to load this week's matchups.");
  await expect(page.locator("#matchupPageState")).toHaveCount(1);
  await expect(page.locator(".track-dropdown, #submitPicksBtn, .matchup-loading-spinner")).toHaveCount(0);
});
