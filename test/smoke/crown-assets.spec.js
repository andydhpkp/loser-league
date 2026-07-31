const { expect, test } = require("@playwright/test");

test("solo and tied crown artwork fill the shared crown dimensions", async ({
  page,
}) => {
  await page.goto("/index.html");
  await page.setContent(`
    <link rel="stylesheet" href="/css/leagueTable.css">
    <img class="crown-icon" data-crown="solo" src="/css/assets/crowns/first_time_solo_winner_crown.png">
    <img class="crown-icon" data-crown="tied" src="/css/assets/crowns/first_time_tie_crown_2_people.png">
  `);

  const crowns = page.locator(".crown-icon");
  await expect(crowns).toHaveCount(2);
  await expect(crowns.nth(0)).toHaveCSS("width", "30px");
  await expect(crowns.nth(0)).toHaveCSS("height", "23px");
  await expect(crowns.nth(1)).toHaveCSS("width", "30px");
  await expect(crowns.nth(1)).toHaveCSS("height", "23px");

  const soloAspectRatio = await crowns.nth(0).evaluate(
    (image) => image.naturalWidth / image.naturalHeight
  );
  expect(soloAspectRatio).toBeGreaterThan(1.15);
});
