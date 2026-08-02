const { expect, test } = require("@playwright/test");
const {
  expectNoDocumentOverflow,
  expectTouchTargets,
  expectVisibleContentWithinViewport,
  installSyntheticApi,
} = require("./support/mobile-contract");

const pages = [
  ["authentication", "/index.html"],
  ["registration", "/create-account.html"],
  ["dashboard", "/dashboard.html"],
  ["help", "/help.html"],
  ["matchup and onboarding", "/profile.html"],
  ["League view", "/league-page.html"],
  ["admin", "/admin.html"],
];

test.beforeEach(async ({ page }) => {
  await installSyntheticApi(page);
  page.on("dialog", (dialog) => dialog.dismiss());
});

for (const [name, url] of pages) {
  test(`${name} shell stays inside the viewport with reachable controls`, async ({ page }) => {
    await page.goto(url);
    await expectNoDocumentOverflow(page);
    await expectVisibleContentWithinViewport(page, "h1, h2, h3, p, form, .alert, .btn, button, input, select");
    await expectTouchTargets(page, ".btn, button, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, .dashboard-action, .track-header, .teamSelection");
  });
}

test("dense League table scrolls intentionally without moving page actions", async ({ page }) => {
  await page.goto("/league-page.html");
  await page.locator("#leagueMain").evaluate((main) => {
    const cells = Array.from({ length: 14 }, (_, index) => `<th scope="col">Synthetic Week ${index + 1}</th>`).join("");
    const values = Array.from({ length: 14 }, () => "<td>Jacksonville Jaguars</td>").join("");
    main.innerHTML = `<table class="table"><thead><tr>${cells}</tr></thead><tbody><tr>${values}</tr></tbody></table>`;
  });
  const scroll = page.getByRole("region", { name: "League standings" });
  await expect(scroll).toBeVisible();
  expect(await scroll.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await expectNoDocumentOverflow(page);
  await expectVisibleContentWithinViewport(page, "body > .d-flex .btn");
});

test("expanded Tracks keep long Team choices usable without page overflow", async ({ page }) => {
  await page.goto("/profile.html");
  await page.locator("#gameMatchups").evaluate((main) => {
    const matchup = (track) => `<article class="track-dropdown expanded"><button class="track-header" type="button"><span class="track-label">Track ${track} — Pick pending</span></button><div class="track-content"><div class="individual-matchup"><button class="teamSelection" type="button"><img class="teamLogos" alt="" src="css/assets/logos/jacksonville-jaguars-logo.png"><h2>Jacksonville Jaguars With A Synthetic Long Name</h2><h3 class="record">(10 - 7)</h3></button><span class="vs">VS</span><button class="teamSelection used_pick" type="button" disabled><img class="teamLogos" alt="" src="css/assets/logos/san-francisco-49ers-logo.png"><h2>San Francisco 49ers With A Synthetic Long Name</h2><h3 class="record">Used Team</h3></button></div></div></article>`;
    main.innerHTML = Array.from({ length: 8 }, (_, index) => matchup(index + 1)).join("");
  });
  await expectNoDocumentOverflow(page);
  await expectVisibleContentWithinViewport(page, ".track-dropdown, .track-header, .teamSelection");
  await expectTouchTargets(page, ".track-header, .teamSelection");
});

test("dense admin workflows wrap long synthetic Users and preserve actions", async ({ page }) => {
  await page.goto("/admin.html");
  await page.getByRole("button", { name: "Add Tracks in Bulk" }).click();
  await expect(page.getByLabel("Tracks for Alexandria-Cassandra Extraordinarily-Long-Synthetic-Name")).toBeVisible();
  await expectNoDocumentOverflow(page);
  await expectVisibleContentWithinViewport(page, "#bulkWorkflow label, #bulkWorkflow input, #bulkWorkflow button, #adminBottomNavigation button");
  await expectTouchTargets(page, "#bulkWorkflow input, #bulkWorkflow button, #adminBottomNavigation button");
});

test("long modal content keeps its heading and actions reachable", async ({ page }) => {
  await page.goto("/profile.html");
  await page.locator("#buybackModal").evaluate((modal) => {
    modal.classList.add("show");
    modal.style.display = "block";
    modal.removeAttribute("aria-hidden");
    const body = modal.querySelector(".modal-body");
    body.insertAdjacentHTML("beforeend", `<p>${"Long synthetic buyback explanation. ".repeat(80)}</p>`);
  });
  const modal = page.locator("#buybackModal .modal-content");
  const bounds = await modal.boundingBox();
  const viewport = page.viewportSize();
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
  await expect(page.getByRole("heading", { name: "Week 2 Track buyback" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Request selected buybacks" })).toBeVisible();
  await expectTouchTargets(page, "#buybackModal button, #buybackModal input:not([type=checkbox]):not([type=radio])");
});

test("every Bootstrap modal stays horizontally centered on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  for (const url of ["/index.html", "/profile.html", "/league-page.html"]) {
    await page.goto(url);
    const dialogs = page.locator(".modal-dialog");
    expect(await dialogs.count()).toBeGreaterThan(0);

    for (const dialog of await dialogs.all()) {
      const bounds = await dialog.evaluate((element) => {
        const modal = element.closest(".modal");
        modal.classList.add("show");
        modal.style.display = "block";
        modal.removeAttribute("aria-hidden");
        const rect = element.getBoundingClientRect();
        return { left: rect.left, width: rect.width };
      });
      expect(Math.abs(bounds.left + bounds.width / 2 - 640)).toBeLessThanOrEqual(1);
    }
  }
});

test("narrow admin help contains focus and restores it when closed", async ({ page }) => {
  await page.goto("/admin.html");
  const workflow = page.getByRole("button", { name: "Make Changes for a User" });
  await workflow.click();
  const help = page.getByRole("button", { name: "Help" });
  await help.click();
  const dialog = page.locator("#adminHelpDialog");
  await expect(dialog).toHaveJSProperty("open", true);
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Tab");
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.getByRole("button", { name: "Close help" }).click();
  await expect(dialog).not.toHaveJSProperty("open", true);
  await expect(help).toBeFocused();
});

test("short landscape keeps a focused input and continuation action reachable", async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 320 });
  await page.goto("/index.html");
  await page.locator("#exampleModal").evaluate((modal) => {
    modal.classList.add("show");
    modal.style.display = "block";
    modal.removeAttribute("aria-hidden");
  });
  const input = page.locator("#forgotPasswordEmail");
  await input.focus();
  await expect(input).toBeInViewport();
  await expect(page.locator("#resetPasswordBtn")).toBeInViewport();
  await expectNoDocumentOverflow(page);
});

test("200 percent text scaling preserves content and actions", async ({ page }) => {
  await page.goto("/dashboard.html");
  await page.addStyleTag({ content: ":root { font-size: 200% !important; }" });
  await expectNoDocumentOverflow(page);
  await expectVisibleContentWithinViewport(page, "h1, h2, p, .dashboard-action, .authenticated-actions .btn");
});

test("reduced motion disables decorative transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/profile.html");
  await page.locator("body").evaluate((body) => {
    const spinner = document.createElement("span");
    spinner.className = "spinner-border matchup-loading-spinner";
    body.append(spinner);
  });
  await expect(page.locator(".matchup-loading-spinner")).toHaveCSS("animation-name", "none");
});
