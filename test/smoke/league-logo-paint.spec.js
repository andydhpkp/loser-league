const { expect, test } = require("@playwright/test");

async function openLeague(page) {
  await page.addInitScript(() => {
    window.repainted = new Set();
    window.maxRepaints = 0;
    new MutationObserver(records => {
      for (const { target } of records) {
        if (target.classList?.contains("logo-repaint")) window.repainted.add(target);
      }
      window.maxRepaints = Math.max(window.maxRepaints, document.querySelectorAll(".logo-repaint").length);
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["class"] });
  });
  await page.route("**/api/**", route => route.fulfill({
    json: route.request().url().includes("/league/view") ? {
      leagueSeason: { year: 2026, week: 1 },
      users: Array.from({ length: 50 }, (_, user) => ({
        id: user + 1, firstName: "Test", lastName: "User", picksSubmitted: true,
        tracks: Array.from({ length: 20 }, (_, index) => ({
          id: user * 20 + index + 1,
          currentPick: { status: "VISIBLE", teamName: "Cleveland Browns" },
        })),
      })),
    } : {},
  }));
  await page.goto("/league-page.html");
  await expect(page.locator("#leagueMain .teamLogos")).toHaveCount(1000);
}

for (const width of [390, 1280]) {
  test(`League repaint is temporary, bounded and follows scrolling (${width})`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 844 });
    await openLeague(page);
    const logos = page.locator("#leagueMain .teamLogos");
    const first = logos.first();
    const last = logos.last();
    await first.scrollIntoViewIfNeeded();
    await expect(first).toHaveClass(/logo-repaint/);
    await expect(first).toHaveCSS("transform", /matrix(3d)?\(/);
    await expect(first).toHaveCSS("width", "70px");
    await expect(first).not.toHaveClass(/logo-repaint/);
    await expect(first).toHaveCSS("transform", "none");
    expect(await last.evaluate(img => window.repainted.has(img))).toBe(false);
    await last.scrollIntoViewIfNeeded();
    // A wide viewport can expose many batches; the last logo waits its turn.
    await expect.poll(() => last.evaluate(img => window.repainted.has(img)), { timeout: 30000 }).toBe(true);
    await expect(last).not.toHaveClass(/logo-repaint/);
    const ratio = await last.evaluate(img => ({ natural: img.naturalWidth / img.naturalHeight, rendered: img.getBoundingClientRect().width / img.getBoundingClientRect().height }));
    expect(ratio.rendered).toBeCloseTo(ratio.natural, 2);
    expect(await page.evaluate(() => window.maxRepaints)).toBeLessThanOrEqual(8);
    expect(await page.evaluate(() => window.repainted.size)).toBeLessThan(1000);
    // Page entry must remove temporary state and reinitialize a restored page.
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
    await expect(page.locator(".logo-repaint")).toHaveCount(0);
    await page.evaluate(() => { window.repainted.clear(); window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })); });
    await expect.poll(() => last.evaluate(img => window.repainted.has(img)), { timeout: 30000 }).toBe(true);
  });
}

test("failed League logos retain fallback text without repaint transforms", async ({ page }) => {
  await page.route("**/css/assets/logos/**", route => route.abort());
  await openLeague(page);
  const cell = page.locator(".teamNames").first();
  await cell.scrollIntoViewIfNeeded();
  await expect(cell.locator("img")).toBeHidden();
  await expect(cell.locator("p").first()).toBeVisible();
  await expect(page.locator(".logo-repaint")).toHaveCount(0);
  expect(await page.evaluate(() => window.repainted.size)).toBe(0);
});

test("scrolling, animation frames and Stats remain usable during repaint batches", async ({ page }) => {
  await openLeague(page);
  await page.locator(".teamLogos").last().scrollIntoViewIfNeeded();
  await expect(page.locator(".logo-repaint").first()).toBeAttached();
  const framesDuringBatch = await page.evaluate(() => new Promise(resolve => {
    let frames = 0;
    function sample() {
      if (document.querySelector(".logo-repaint")) frames++;
      if (frames >= 4 || !document.querySelector(".logo-repaint")) resolve(frames);
      else requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }));
  expect(framesDuringBatch).toBe(4);
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.move(200, 400);
  await page.mouse.wheel(0, -150);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(before);
  await page.locator("#viewWeekStatsBtn").click();
  await expect(page.locator("#weekStatsModal")).toBeVisible();
});
