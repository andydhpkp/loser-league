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
        tracks: [{ trackId: 9, weekOnePick: "Bears", resolution: null }],
        contacts: [], payment: null,
      },
    }),
  }));
  await page.route("**/api/users/logged", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: 7 }) }));
  await page.goto("/profile.html");

  await expect(page.getByRole("heading", { name: "Week 2 Track buyback" })).toBeVisible();
  await expect(page.getByText("Track 9 — Week 1 Pick: Bears")).toBeVisible();
  await expect(page.getByText("$10.00 × 0 = $0.00")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Resolve your Week 2 buyback decision");
});
