const { expect, test } = require("@playwright/test");

async function openLeague(page, query = "?logoDiagnostics=1", teams = ["Cleveland Browns"]) {
  await page.route("**/api/**", route => route.fulfill({ json: route.request().url().includes("/league/view") ? {
    leagueSeason: { year: 2026, week: 1 }, users: [{ id: 92841, firstName: "PRIVATE_FIXTURE_NAME", lastName: "Example", picksSubmitted: true,
      tracks: teams.map((teamName, index) => ({ id: 84721 + index, currentPick: { status: "VISIBLE", teamName } })) }],
  } : { content: { schedule: {} } } }));
  await page.goto(`/league-page.html${query}`);
  await expect(page.locator("#leagueMain .teamLogos")).toHaveCount(teams.length);
}
async function readReport(page) {
  return JSON.parse(await page.locator("#logoDiagnosticReport").inputValue());
}
async function selectImage(page) {
  await page.locator("#leagueMain .teamNames").first().click();
  await expect(page.locator("#logoDiagnosticReport")).toBeVisible();
}

test("diagnostics are absent unless the single explicit flag is enabled", async ({ page }) => {
  for (const query of ["", "?logoDiagnostics=0", "?logoDiagnostics=1&logoDiagnostics=0"]) {
    await openLeague(page, query);
    await expect(page.locator("#logoDiagnostics")).toHaveCount(0);
  }
});

test("tap captures only technical image state and copy preserves that snapshot", async ({ page }) => {
  await page.addInitScript(() => {
    window.copiedReport = null;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async text => { window.copiedReport = text; } } });
  });
  await openLeague(page, "?logoDiagnostics=1&unrelated=DO_NOT_COPY_QUERY");
  await expect(page.locator("#copyLogoReport")).toBeDisabled();
  await expect(page.locator("#leagueMain .teamLogos")).toHaveJSProperty("complete", true);
  await page.locator("#leagueMain .teamLogos").scrollIntoViewIfNeeded();
  await expect(page.locator("#leagueMain .teamLogos")).toHaveClass(/logo-repaint/);
  await expect(page.locator("#leagueMain .teamLogos")).not.toHaveClass(/logo-repaint/);
  await selectImage(page);
  const report = await readReport(page);
  expect(Object.keys(report).sort()).toEqual(["image", "observed", "schema", "viewport"]);
  expect(report.schema).toBe("league-logo-diagnostics-v2");
  expect(report.image.complete).toBe(true);
  expect(report.image.naturalWidth).toBeGreaterThan(0);
  expect(report.image.hidden).toBe(false);
  expect(report.observed.repaintStarts).toBeGreaterThanOrEqual(1);
  expect(report.observed.repaintFinishes).toBeGreaterThanOrEqual(1);
  expect(report.observed.repaintTransformObserved).toBe(true);
  expect(report.observed.loads).toBe(1);
  expect(Object.keys(report.image).sort()).toEqual(["complete", "display", "height", "hidden", "inVisibleRegion", "manualRepaintClass", "naturalHeight", "naturalWidth", "opacity", "repaintClass", "transformed", "visibility", "width"]);
  expect(Object.keys(report.observed).sort()).toEqual(["elapsedMs", "errors", "loads", "manualRepaintFinishes", "manualRepaintStarts", "repaintFinishes", "repaintStarts", "repaintTransformObserved"]);
  const serialized = JSON.stringify(report);
  for (const forbidden of ["PRIVATE_FIXTURE_NAME", "Example", "92841", "84721", "Cleveland", "/css/", "DO_NOT_COPY_QUERY", "http", "cookie"]) expect(serialized).not.toContain(forbidden);
  await page.locator("#copyLogoReport").click();
  expect(await page.evaluate(() => JSON.parse(window.copiedReport))).toEqual(report);
  await expect(page.locator("#logoDiagnosticStatus")).toHaveText("Report copied.");
});

test("failed image can be inspected through its cell and denied clipboard offers manual copy", async ({ page }) => {
  await page.route("**/css/assets/logos/**", route => route.abort());
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Denied"); } } }));
  await openLeague(page);
  await expect(page.locator(".teamLogos")).toBeHidden();
  await selectImage(page);
  const report = await readReport(page);
  expect(report.image.hidden).toBe(true);
  await expect(page.locator("#repaintLogo")).toBeDisabled();
  expect(report.image.naturalWidth).toBe(0);
  expect(report.observed.errors).toBe(2);
  await page.locator("#copyLogoReport").click();
  await expect(page.locator("#logoDiagnosticStatus")).toContainText("Select and copy");
  await expect(page.locator("#logoDiagnosticReport")).toBeFocused();
});

test("report refresh reads visibility without modifying the image and page restoration resets observation", async ({ page }) => {
  await openLeague(page);
  await selectImage(page);
  await page.locator(".teamLogos").evaluate(image => { image.style.opacity = "0"; });
  await page.locator("#refreshLogoReport").click();
  expect((await readReport(page)).image.opacity).toBe(0);
  await expect(page.locator(".teamLogos")).toHaveCSS("opacity", "0");
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
  await expect(page.locator("#logoDiagnostics")).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(page.locator("#logoDiagnostics")).toHaveCount(1);
  await expect(page.locator("#copyLogoReport")).toBeDisabled();
});

for (const width of [320, 390]) {
  test(`diagnostic controls and report fit phone viewport (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 568 });
    await openLeague(page);
    await selectImage(page);
    for (const selector of ["#logoDiagnostics", "#logoDiagnosticReport", "#copyLogoReport", "#refreshLogoReport", "#repaintLogo"]) {
      const box = await page.locator(selector).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    for (const selector of ["#copyLogoReport", "#refreshLogoReport", "#repaintLogo", "#logoDiagnostics summary"]) {
      const box = await page.locator(selector).boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
}

test("manual repaint affects only the selection, rejects repeated starts and makes no image request", async ({ page }) => {
  let imageRequests = 0;
  page.on("request", request => { if (request.url().includes("/css/assets/logos/")) imageRequests++; });
  await openLeague(page, "?logoDiagnostics=1", ["Cleveland Browns", "Denver Broncos"]);
  await expect(page.locator("#repaintLogo")).toBeDisabled();
  const image = page.locator(".teamLogos").first();
  await image.scrollIntoViewIfNeeded();
  await expect(image).toHaveClass(/logo-repaint/);
  await expect(image).not.toHaveClass(/logo-repaint/);
  await expect(image).toHaveClass(/logo-repaint/);
  await expect(image).not.toHaveClass(/logo-repaint/);
  await selectImage(page);
  const before = await readReport(page);
  const requestsBefore = imageRequests;
  const sourceBefore = await image.getAttribute("src");
  await page.locator("#repaintLogo").click();
  await expect(image).toHaveClass(/logo-diagnostic-repaint/);
  await expect(image).toHaveCSS("transform", /matrix(3d)?\(/);
  await expect(page.locator(".logo-diagnostic-repaint")).toHaveCount(1);
  await expect(page.locator(".teamLogos").nth(1)).not.toHaveClass(/logo-diagnostic-repaint/);
  await expect(page.locator("#repaintLogo")).toBeDisabled();
  await expect(page.locator("#logoDiagnostics")).not.toHaveAttribute("open");
  await page.locator("#repaintLogo").dispatchEvent("click");
  await expect(image).not.toHaveClass(/logo-diagnostic-repaint/);
  await expect(image).toHaveCSS("transform", "none");
  const after = await readReport(page);
  expect(after.observed.manualRepaintStarts).toBe(1);
  expect(after.observed.manualRepaintFinishes).toBe(1);
  expect(after.observed.repaintStarts).toBe(before.observed.repaintStarts);
  expect(after.observed.repaintFinishes).toBe(before.observed.repaintFinishes);
  expect(await image.getAttribute("src")).toBe(sourceBefore);
  expect(imageRequests).toBe(requestsBefore);
  await expect(page.locator("#logoDiagnosticStatus")).toContainText("Did the logo appear");
});

test("page exit cancels an active manual repaint and clears its class", async ({ page }) => {
  await openLeague(page);
  const image = page.locator(".teamLogos");
  await image.scrollIntoViewIfNeeded();
  await expect(image).toHaveClass(/logo-repaint/);
  await expect(image).not.toHaveClass(/logo-repaint/);
  await expect(image).toHaveClass(/logo-repaint/);
  await expect(image).not.toHaveClass(/logo-repaint/);
  await selectImage(page);
  await page.locator("#repaintLogo").click();
  await expect(image).toHaveClass(/logo-diagnostic-repaint/);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
  await expect(image).not.toHaveClass(/logo-diagnostic-repaint/);
  await expect(page.locator("#logoDiagnostics")).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(page.locator("#logoDiagnostics")).toHaveCount(1);
  await expect(page.locator("#repaintLogo")).toBeDisabled();
});

test("manual action cannot remove or overlap the automatic repaint class", async ({ page }) => {
  await openLeague(page);
  const image = page.locator(".teamLogos");
  await image.scrollIntoViewIfNeeded();
  await expect(image).toHaveClass(/logo-repaint/);
  await expect(image).not.toHaveClass(/logo-repaint/);
  await expect(image).toHaveClass(/logo-repaint/);
  await expect(image).not.toHaveClass(/logo-repaint/);
  await selectImage(page);
  await image.evaluate(element => element.classList.add("logo-repaint"));
  await expect(page.locator("#repaintLogo")).toBeDisabled();
  await page.locator("#repaintLogo").dispatchEvent("click");
  await expect(image).toHaveClass(/logo-repaint/);
  await expect(image).not.toHaveClass(/logo-diagnostic-repaint/);
  await image.evaluate(element => element.classList.remove("logo-repaint"));
  await expect(page.locator("#repaintLogo")).toBeEnabled();
});
