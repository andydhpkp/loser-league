const { test, expect } = require("@playwright/test");

test("eligible Week 2 User sees exact buyback Tracks, price, and Pick gate", async ({ page }) => {
  await page.addInitScript(() => {
    window.bootstrap = { Modal: { getOrCreateInstance: (element) => ({ show: () => { element.dataset.shown = "true"; element.style.display = "block"; } }) } };
  });
  await page.route("**/api/user/league/submission", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      leagueSeason: { id: 1, year: 2026, week: 2, state: "ACTIVE" },
      submissionOpen: true,
      tracks: [],
      buyback: {
        status: "ELIGIBLE", stateVersion: 0, pickBlocked: true,
        unitPriceCents: 1000, selectedCount: 0, totalCents: 0,
        tracks: [{ trackId: 1200, weekOnePick: "Bears", resolution: null }],
        contacts: [], payment: null,
      },
    }),
  }));
  await page.route("**/api/users/logged", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: 7 }) }));
  await page.goto("/profile.html");

  await expect(page.getByRole("heading", { name: "Week 2 Track buyback" })).toBeVisible();
  await expect(page.getByText("Track 1 — Week 1 Pick: Bears")).toBeVisible();
  await expect(page.getByText(/Track 1200/)).toHaveCount(0);
  await expect(page.getByText("$10.00 × 0 = $0.00")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Resolve your Week 2 buyback decision");
});

test("later-week preseason User sees phase-aware buyback copy", async ({ page }) => {
  await page.addInitScript(() => {
    window.bootstrap = { Modal: { getOrCreateInstance: (element) => ({ show: () => { element.dataset.shown = "true"; element.style.display = "block"; } }) } };
  });
  await page.route("**/api/user/league/submission", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      leagueSeason: { id: 1, year: 2026, week: 4, state: "ACTIVE", schedulePhase: "PRESEASON" },
      submissionOpen: true,
      tracks: [],
      buyback: {
        status: "ELIGIBLE", stateVersion: 0, pickBlocked: true, schedulePhase: "PRESEASON",
        unitPriceCents: 1000, selectedCount: 0, totalCents: 0,
        tracks: [{ trackId: 1200, weekOnePick: "Bears", resolution: null }],
        contacts: [], payment: null,
      },
    }),
  }));
  await page.route("**/api/users/logged", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: 7 }) }));
  await page.goto("/profile.html");

  await expect(page.getByRole("heading", { name: "Preseason Track buyback" })).toBeVisible();
  await expect(page.getByText("Track 1 — Eliminating Pick: Bears")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Resolve your preseason buyback decision");
});

test("buyback submission locks the modal against repeated or changed decisions", async ({ page }) => {
  await page.addInitScript(() => {
    window.bootstrap = { Modal: { getOrCreateInstance: (element) => ({ show: () => { element.dataset.shown = "true"; element.style.display = "block"; } }) } };
  });
  await page.route("**/api/user/league/submission", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      leagueSeason: { id: 1, year: 2026, week: 2, state: "ACTIVE" },
      submissionOpen: true,
      tracks: [],
      buyback: {
        status: "ELIGIBLE", stateVersion: 0, pickBlocked: true,
        unitPriceCents: 1000, selectedCount: 0, totalCents: 0,
        tracks: [{ trackId: 1200, weekOnePick: "Bears", resolution: null }],
        contacts: [], payment: null,
      },
    }),
  }));
  await page.route("**/api/users/logged", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: 7 }) }));

  let requestCount = 0;
  let requestBody;
  let finishRequest;
  await page.route("**/api/user/league/buyback/request", async (route) => {
    requestCount += 1;
    requestBody = route.request().postDataJSON();
    await new Promise((resolve) => { finishRequest = resolve; });
    await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ message: "Buyback decision changed; reload before continuing" }) });
  });
  await page.goto("/profile.html");

  const track = page.locator("#buybackTrack1200");
  await track.check();
  await page.getByRole("button", { name: "Request selected buybacks" }).click();
  await expect(page.locator("#buybackConfirmationSummary")).toContainText("Track 1");
  await expect(page.locator("#buybackConfirmationSummary")).not.toContainText("1200");
  const confirm = page.locator("#confirmBuybackRequest");
  await confirm.evaluate((button) => { button.click(); button.click(); });

  await expect(confirm).toBeDisabled();
  await expect(confirm).toHaveText("Submitting…");
  await expect(track).toBeDisabled();
  await track.evaluate((input) => input.click());
  await expect(track).toBeChecked();
  expect(requestCount).toBe(1);
  expect(requestBody).toEqual({ trackIds: [1200], stateVersion: 0 });

  finishRequest();
  await expect(page.locator("#buybackError")).toContainText("Buyback decision changed; reload before continuing");
  await expect(confirm).toBeEnabled();
  await expect(confirm).toHaveText("Confirm final decision");
  await expect(track).toBeEnabled();
});
