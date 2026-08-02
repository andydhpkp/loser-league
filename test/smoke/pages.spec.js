const { expect, test } = require("@playwright/test");

const pages = [
  ["home", "/index.html", "home.js"],
  ["registration", "/create-account.html", "register.js"],
  ["profile", "/profile.html", "profile.js"],
  ["league", "/league-page.html", "league.js"],
  ["admin", "/admin.html", "admin.js"],
];

for (const [name, url, entry] of pages) {
  test(`${name} page loads its module entry without an uncaught error`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("dialog", (dialog) => dialog.dismiss());

    await page.route("**/api/**", async (route) => {
      const requestUrl = route.request().url();
      let body = [];

      if (requestUrl.includes("/api/users/logged")) {
        body = {};
      } else if (requestUrl.includes("/api/user/league/view")) {
        body = { leagueSeason: { id: 1, year: 2026, week: 1 }, pickVisibility: "VISIBLE", users: [] };
      } else if (requestUrl.includes("/api/user/league/submission")) {
        body = {
          leagueSeason: { id: 1, year: 2026, week: 1, state: "ACTIVE" },
          tracks: [{ id: 1, stateVersion: 0, status: "NOT_SUBMITTED", committedTeamName: null, usedTeamNames: [], eligibleTeams: [] }],
        };
      } else if (route.request().method() !== "GET") {
        body = {};
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });
    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await expect(
      page.locator(`script[type="module"][src$="${entry}"]`)
    ).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

test("admin numeric fields hide browser spinner controls", async ({ page }) => {
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    })
  );
  await page.goto("/admin.html");

  const appearance = await page.locator("#overrideHomeScore").evaluate(
    (input) => getComputedStyle(input).appearance
  );

  expect(appearance).toBe("textfield");
});
