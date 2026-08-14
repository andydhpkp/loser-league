const { expect, test } = require("@playwright/test");

const summary = { leagueSeason: { year: 2026, week: 4, state: "ACTIVE" }, deadline: { available: true, timestamp: "2026-09-10T00:00:00.000Z" }, tracks: { active: 3, missingPicks: 2 }, leagueView: { allowed: false, label: "Submit Picks for all active Tracks before viewing the League." }, makePicks: { code: "PICKS_REQUIRED", label: "2 Picks still needed" }, features: { pickReminders: false } };

test("dashboard renders authoritative summary and approved action order", async ({ page }) => {
  await page.route("**/api/user/dashboard", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(summary) }));
  await page.goto("/dashboard.html");
  await expect(page.getByRole("navigation", { name: "Primary" }).locator(".dashboard-action:visible")).toHaveText([/View League/, /Make Picks/, /Help/]);
  await expect(page.getByText("Active Tracks: 3 · Missing Picks: 2")).toBeVisible();
  await expect(page.getByText("2 Picks still needed")).toBeVisible();
  await expect(page.getByText("Submit Picks for all active Tracks before viewing the League.")).toBeVisible();
  await expect(page.getByText("View League").locator("..")).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByText(/Text Pick Reminder/i)).toHaveCount(0);
  await expect(page.getByText("Pick Reminder Settings")).toBeHidden();
  await expect(page.getByText(/Next Pick deadline: .+\b(?:UTC|GMT|[A-Z]{2,5})\b/)).toBeVisible();
});

test("effective-access dashboard preserves the disabled Pick Reminder Settings seam", async ({ page }) => {
  await page.route("**/api/user/dashboard", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...summary, features: { pickReminders: true } }) }));
  await page.goto("/dashboard.html");
  await expect(page.getByText("Pick Reminder Settings")).toBeVisible();
  await expect(page.getByText("Pick Reminder Settings").locator("..")).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("link", { name: /Pick Reminder Settings/ })).toHaveCount(0);
});

test("blocked direct League visits return to the dashboard with an explanation", async ({ page }) => {
  await page.route("**/api/user/league/view", (route) => route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "CONFLICT", message: "Submit Picks for all active Tracks before viewing the League." }) }));
  await page.route("**/api/user/dashboard", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(summary) }));
  await page.goto("/league-page.html");
  await expect(page).toHaveURL(/\/dashboard\.html\?leagueView=blocked$/);
  await expect(page.getByText("Submit Picks for all active Tracks before viewing the League.")).toBeVisible();
});

test("dashboard links to the League when every active Track has a Pick", async ({ page }) => {
  const allowed = { ...summary, tracks: { active: 3, missingPicks: 0 }, leagueView: { allowed: true, label: "See the current league standings and visible Picks." } };
  await page.route("**/api/user/dashboard", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(allowed) }));
  await page.goto("/dashboard.html");
  await expect(page.getByRole("link", { name: /View League/ })).toHaveAttribute("href", "/league-page.html");
});

test("dashboard failure is recoverable and expired sessions return to login", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/user/dashboard", (route) => {
    attempts += 1;
    route.fulfill(attempts === 1 ? { status: 500, body: "{}" } : { status: 200, contentType: "application/json", body: JSON.stringify(summary) });
  });
  await page.goto("/dashboard.html");
  await expect(page.getByText("We could not load your current summary. Try again.")).toBeVisible();
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("Active Tracks: 3 · Missing Picks: 2")).toBeVisible();

  await page.route("**/api/user/dashboard", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.reload();
  await page.waitForURL(/\/index\.html$/, { waitUntil: "load" });
});

test("Help explains active rules without reminder or admin material", async ({ page }) => {
  await page.route("**/api/user/league/support", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ contacts: [{ name: "Tate", smsUrl: "sms:+15555550100" }] }) }));
  await page.goto("/help.html");
  await expect(page.getByText(/cannot choose the same NFL Team twice/i)).toBeVisible();
  await expect(page.getByText(/wins or ties/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Text Tate for help" })).toHaveAttribute("href", "sms:+15555550100");
  await expect(page.getByText(/reminder|admin password|repair/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("href", "/dashboard.html");
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
});

test("login and registration navigate to the dashboard", async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    const body = url.includes("/api/users/login") ? { user: { id: 1 } } : url.includes("/api/user/dashboard") ? summary : [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/index.html");
  await page.locator("#inputUsername").fill("user");
  await page.locator("#inputPassword").fill("password");
  await page.locator(".login-form").evaluate((form) => form.requestSubmit());
  await expect(page).toHaveURL(/\/dashboard\.html$/);

  await page.goto("/create-account.html");
  await page.locator("#createFirstName").fill("Test");
  await page.locator("#createLastName").fill("User");
  await page.locator("#createUsername").fill("test-user");
  await page.locator("#createEmail").fill("test@example.test");
  await page.locator("#createPassword").fill("password");
  await page.locator(".register-form").evaluate((form) => form.requestSubmit());
  await expect(page).toHaveURL(/\/dashboard\.html$/);
});
