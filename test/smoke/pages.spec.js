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
      } else if (route.request().method() !== "GET") {
        body = {};
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });
    await page.route("**/site.api.espn.com/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ events: [], sports: [] }),
      })
    );

    await page.goto(url);
    await page.waitForLoadState("networkidle");

    await expect(
      page.locator(`script[type="module"][src$="${entry}"]`)
    ).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}
