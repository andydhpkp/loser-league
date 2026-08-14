const { expect, test } = require("@playwright/test");

async function expectLoading(locator, message) {
  await expect(locator).toContainText(message);
  await expect(locator.locator(".loading-spinner")).toHaveCount(1);
  await expect(locator.locator(".loading-spinner")).toHaveAttribute("aria-hidden", "true");
}

test("Dashboard literal loading messages include accessible decorative spinners", async ({ page }) => {
  await page.route("**/api/user/dashboard", () => new Promise(() => {}));
  await page.goto("/dashboard.html", { waitUntil: "domcontentloaded" });

  await expectLoading(page.locator("#dashboardStatus"), "Loading your League Season summary…");
  await expectLoading(page.locator("#viewLeagueStatus"), "Loading League access…");
  await expectLoading(page.locator("#makePicksStatus"), "Loading Pick status…");
});

test("Help loading feedback uses a spinner and its settings call to action is a Bootstrap link button", async ({ page }) => {
  await page.route("**/api/user/league/support", () => new Promise(() => {}));
  await page.goto("/help.html", { waitUntil: "domcontentloaded" });

  await expectLoading(page.locator("#supportContacts"), "Loading contact options…");
  const settings = page.getByRole("link", { name: "Open Pick Reminder Settings" });
  await expect(settings).toHaveAttribute("href", "/reminder-settings.html");
  await expect(settings).toHaveClass(/\bbtn\b/);
  await expect(settings).toHaveClass(/\bbtn-primary\b/);
});

test("Pick Reminder Settings literal loading messages include spinners", async ({ page }) => {
  await page.route("**/api/user/reminders/**", () => new Promise(() => {}));
  await page.goto("/reminder-settings.html", { waitUntil: "domcontentloaded" });

  await expectLoading(page.locator("#pageStatus"), "Loading reminder options…");
  await expectLoading(page.locator("#pushStatus"), "Loading…");
  await expectLoading(page.locator("#emailStatus"), "Loading…");
  await expectLoading(page.locator("#calendarStatus"), "Loading…");
});

test("admin literal loading messages use spinners and remove them after completion", async ({ page }) => {
  let releaseFeatures;
  let releaseOperations;
  const featuresPending = new Promise((resolve) => { releaseFeatures = resolve; });
  const operationsPending = new Promise((resolve) => { releaseOperations = resolve; });

  await page.route("**/api/users", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/api/admin/features", async (route) => {
    await featuresPending;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ features: { pickReminders: { publicReleased: false } } }) });
  });
  await page.route("**/api/admin/reminders", async (route) => {
    await operationsPending;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ counts: {} }) });
  });

  const navigation = page.goto("/admin.html", { waitUntil: "domcontentloaded" });
  await expectLoading(page.locator("#pickRemindersReleaseStatus"), "Loading Pick Reminders release state…");
  await expectLoading(page.locator("#reminderOperationsStatus"), "Loading aggregate reminder status…");

  releaseFeatures();
  releaseOperations();
  await navigation;
  await expect(page.locator("#pickRemindersReleaseStatus .loading-spinner, #reminderOperationsStatus .loading-spinner")).toHaveCount(0);
});

test("admin game-odds loading feedback uses a spinner", async ({ page }) => {
  await page.route("**/api/users", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/api/admin/features", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ features: { pickReminders: { publicReleased: false } } }) }));
  await page.route("**/api/admin/reminders", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ counts: {} }) }));
  await page.route("**/api/admin/league-season", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ leagueSeason: { id: 1, year: 2026, week: 1 } }) }));
  await page.route("**/api/proxy/nfl-odds", () => new Promise(() => {}));
  await page.goto("/admin.html");

  await page.getByRole("button", { name: "View Statistics" }).click();
  await page.getByRole("dialog", { name: "Weekly Statistics" }).getByRole("button", { name: "Reload Game Odds" }).click();
  await expectLoading(page.locator("#statisticsOddsStatus"), "Loading game odds…");
});

test("shared spinner stops animation when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/user/league/support", () => new Promise(() => {}));
  await page.goto("/help.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#supportContacts .loading-spinner")).toHaveCSS("animation-name", "none");
});
