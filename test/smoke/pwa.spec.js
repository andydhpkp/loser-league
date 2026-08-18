const { expect, test } = require("@playwright/test");
const summary = { leagueSeason: { year: 2026, week: 4, state: "ACTIVE" }, deadline: { available: false }, tracks: { active: 0, picksSubmitted: null }, leagueView: { allowed: true, label: "View League" }, makePicks: { label: "No Picks required" }, features: { pickReminders: false } };
test("manifest, local icons, and privacy-safe service worker shell are available", async ({ page, context }) => {
  await page.route("**/api/user/dashboard", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(summary) }));
  await page.goto("/dashboard.html");
  const manifest = await context.request.get("/manifest.webmanifest"); const body = await manifest.json();
  expect(body.name).toBe("Loser League"); expect(body.start_url).toBe("/dashboard.html"); expect(body.display).toBe("standalone");
  for (const icon of body.icons) expect((await context.request.get(icon.src)).ok()).toBeTruthy();
  await page.waitForFunction(() => navigator.serviceWorker?.ready);
  const cached = await page.evaluate(async () => (await caches.keys()).flatMap(() => []));
  expect(cached).toEqual([]);
  const cacheEntries = await page.evaluate(async () => { const names = await caches.keys(); const entries = []; for (const name of names) entries.push(...(await (await caches.open(name)).keys()).map((request) => new URL(request.url).pathname)); return entries; });
  expect(cacheEntries).not.toContain("/api/user/dashboard"); expect(cacheEntries).not.toContain("/dashboard.html"); expect(cacheEntries).toContain("/offline.html");
});

test("cached shared CSS refreshes from the network when a new version is deployed", async ({ page }) => {
  await page.route("**/api/user/dashboard", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(summary) }));
  await page.goto("/dashboard.html");
  await page.waitForFunction(() => navigator.serviceWorker?.ready && navigator.serviceWorker.controller);
  await page.evaluate(async () => {
    const cache = await caches.open("loser-league-shell-v1");
    await cache.put("/css/styles.css", new Response("stale-stylesheet", { headers: { "Content-Type": "text/css" } }));
  });

  const stylesheet = await page.evaluate(async () => (await fetch("/css/styles.css")).text());

  expect(stylesheet).toContain(".table .teamLogos");
  expect(stylesheet).not.toContain("stale-stylesheet");
});
