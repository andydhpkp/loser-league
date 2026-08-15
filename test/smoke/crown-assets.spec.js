const { expect, test } = require("@playwright/test");

test("solo and tied crown artwork preserve their aspect ratio in the League table", async ({
  page,
}) => {
  await page.goto("/index.html");
  await page.setContent(`
    <link rel="stylesheet" href="/css/styles.css">
    <link rel="stylesheet" href="/css/leagueTable.css">
    <style>.table td { padding: 0.5rem; }</style>
    <table class="table">
      <tbody>
        <tr>
          <td class="crown-column"><img class="crown-icon" data-crown="solo" src="/css/assets/crowns/first_time_solo_winner_crown.png"></td>
          <td class="crown-column"><img class="crown-icon" data-crown="tied" src="/css/assets/crowns/first_time_tie_crown_2_people.png"></td>
        </tr>
      </tbody>
    </table>
  `);

  const crowns = page.locator(".crown-icon");
  await expect(crowns).toHaveCount(2);
  await expect(crowns.nth(0)).toHaveCSS("height", "23px");
  await expect(crowns.nth(1)).toHaveCSS("height", "23px");

  for (const crown of await crowns.all()) {
    const ratios = await crown.evaluate((image) => ({
      natural: image.naturalWidth / image.naturalHeight,
      rendered: image.getBoundingClientRect().width / image.getBoundingClientRect().height,
    }));
    expect(ratios.rendered).toBeCloseTo(ratios.natural, 2);
  }
});

test("checked-in Team logos retain their natural aspect ratios", async ({ page }) => {
  await page.goto("/index.html");
  await page.setContent(`
    <link rel="stylesheet" href="/css/styles.css">
    <table class="table"><tbody><tr><td><img class="teamLogos" data-logo="league" src="/css/assets/logos/baltimore-ravens-logo.png"></td></tr></tbody></table>
  `);

  const leagueLogo = page.locator('[data-logo="league"]');
  await expect(leagueLogo).toHaveCSS("width", "70px");

  const ratios = await leagueLogo.evaluate((image) => ({
    natural: image.naturalWidth / image.naturalHeight,
    rendered: image.getBoundingClientRect().width / image.getBoundingClientRect().height,
  }));
  expect(ratios.rendered).toBeCloseTo(ratios.natural, 2);
});
