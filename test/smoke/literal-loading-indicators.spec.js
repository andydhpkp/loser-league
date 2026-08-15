const { expect, test } = require("@playwright/test");

test("Dashboard uses concise text-only loading statuses", async ({ page }) => {
  await page.route("**/api/user/dashboard", () => new Promise(() => {}));
  await page.goto("/dashboard.html", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#dashboardStatus")).toHaveText("Loading your League Season summary…");
  await expect(page.locator("#viewLeagueStatus")).toHaveText("Loading League access…");
  await expect(page.locator("#makePicksStatus")).toHaveText("Loading Pick status…");
  await expect(page.locator(".spinner-border")).toHaveCount(0);
});

test("Help uses text-only contact loading and keeps its Bootstrap settings call to action", async ({ page }) => {
  await page.route("**/api/user/league/support", () => new Promise(() => {}));
  await page.goto("/help.html", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#supportContacts")).toHaveText("Loading contact options…");
  await expect(page.locator(".spinner-border")).toHaveCount(0);
  const settings = page.getByRole("link", { name: "Open Pick Reminder Settings" });
  await expect(settings).toHaveAttribute("href", "/reminder-settings.html");
  await expect(settings).toHaveClass(/\bbtn\b/);
  await expect(settings).toHaveClass(/\bbtn-primary\b/);
});

test("Pick Reminder Settings uses concise text-only loading statuses", async ({ page }) => {
  await page.route("**/api/user/reminders/**", () => new Promise(() => {}));
  await page.goto("/reminder-settings.html", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#pageStatus")).toHaveText("Loading reminder options…");
  await expect(page.locator("#pushStatus")).toHaveText("Loading…");
  await expect(page.locator("#emailStatus")).toHaveText("Loading…");
  await expect(page.locator("#calendarStatus")).toHaveText("Loading…");
  await expect(page.locator(".spinner-border")).toHaveCount(0);
});

test("admin uses concise text-only loading statuses", async ({ page }) => {
  await page.route("**/api/users", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/api/admin/features", () => new Promise(() => {}));
  await page.route("**/api/admin/reminders", () => new Promise(() => {}));
  await page.goto("/admin.html", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#pickRemindersReleaseStatus")).toHaveText("Loading Pick Reminders release state…");
  await expect(page.locator("#reminderOperationsStatus")).toHaveText("Loading aggregate reminder status…");
  await expect(page.locator(".spinner-border")).toHaveCount(0);
});

test("admin game-odds loading feedback is concise text", async ({ page }) => {
  await page.route("**/api/users", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/api/admin/features", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ features: { pickReminders: { publicReleased: false } } }) }));
  await page.route("**/api/admin/reminders", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ counts: {} }) }));
  await page.route("**/api/admin/league-season", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ leagueSeason: { id: 1, year: 2026, week: 1 } }) }));
  await page.route("**/api/proxy/nfl-odds", () => new Promise(() => {}));
  await page.goto("/admin.html");

  await page.getByRole("button", { name: "View Statistics" }).click();
  const modal = page.getByRole("dialog", { name: "Weekly Statistics" });
  await modal.getByRole("button", { name: "Reload Game Odds" }).click();
  await expect(page.locator("#statisticsOddsStatus")).toHaveText("Loading game odds…");
  await expect(modal.locator(".spinner-border")).toHaveCount(0);
});

test("the whole-matchup load remains the only spinner loading state", async ({ page }) => {
  await page.route("**/api/user/league/submission", () => new Promise(() => {}));
  await page.goto("/profile.html", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#matchupPageState")).toContainText("Loading this week's matchups…");
  await expect(page.locator(".spinner-border.matchup-loading-spinner")).toHaveCount(1);
  await expect(page.locator(".spinner-border")).toHaveCount(1);
});
