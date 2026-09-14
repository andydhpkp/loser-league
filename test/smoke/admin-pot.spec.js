const { test, expect } = require('@playwright/test');

test('admin pot shows original and buyback contributions, refreshes and fails without stale totals', async ({ page }) => {
  let fail = false;
  let count = 2;
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await page.route('**/api/admin/pot', route => route.fulfill(fail ? { status: 503, json: {} } : { json: {
    leagueSeason: { year: 2026, schedulePhase: 'REGULAR' }, trackCount: 10, buybackCount: count,
    baseCents: 5000, buybackCents: count * 1000, totalCents: 5000 + count * 1000,
  } }));
  await page.goto('/admin.html');
  await expect(page.locator('#leaguePotTotal')).toHaveText('$70.00');
  await expect(page.locator('#leaguePotBreakdown')).toContainText('10 Tracks');
  await expect(page.locator('#leaguePotBreakdown')).toContainText('2 completed buybacks');
  count = 3;
  await page.locator('#refreshLeaguePot').click();
  await expect(page.locator('#leaguePotTotal')).toHaveText('$80.00');
  fail = true;
  await page.locator('#refreshLeaguePot').click();
  await expect(page.locator('#leaguePotTotal')).toHaveText('Unavailable');
  await expect(page.locator('#leaguePotBreakdown')).toBeEmpty();
  const box = await page.locator('#leaguePot').boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(390);
});

test('pot distinguishes no season, zero totals and preseason testing', async ({ page }) => {
  let payload = { leagueSeason: null };
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await page.route('**/api/admin/pot', route => route.fulfill({ json: payload }));
  await page.goto('/admin.html');
  await expect(page.locator('#leaguePotTotal')).toHaveText('No League Season');
  payload = { leagueSeason: { year: 2026, schedulePhase: 'PRESEASON' }, trackCount: 0, buybackCount: 0, baseCents: 0, buybackCents: 0, totalCents: 0 };
  await page.locator('#refreshLeaguePot').click();
  await expect(page.locator('#leaguePotTotal')).toHaveText('$0.00');
  await expect(page.locator('#leaguePotHeading')).toHaveText('2026 preseason test pot');
  payload = { leagueSeason: { year: 2026 } };
  await page.locator('#refreshLeaguePot').click();
  await expect(page.locator('#leaguePotTotal')).toHaveText('Unavailable');
});
