const { expect, test } = require("@playwright/test");

for (const width of [320, 375, 390, 412, 1280]) {
  for (const reducedMotion of ["no-preference", "reduce"]) {
    test(`selection preserves the logo and returns to its Track (${width}, ${reducedMotion})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ reducedMotion });
      await page.clock.setFixedTime(new Date("2026-09-01T12:00:00Z"));
      await page.route("**/api/**", async (route) => {
        const url = route.request().url();
        let body = {};
        if (url.includes("/league/submission")) body = {
          leagueSeason: { id: 1, year: 2026, week: 1, state: "ACTIVE" }, submissionOpen: true,
          tracks: Array.from({ length: 10 }, (_, i) => ({ id: i + 1, stateVersion: 0, status: "NOT_SUBMITTED", usedTeamNames: [] })),
        };
        else if (url.includes("/nfl/schedule")) body = {
          content: { schedule: { day: {
            games: Array.from({ length: 12 }, () => ({
              date: "2026-09-10T00:00:00Z",
              competitions: [{ competitors: [
                { homeAway: "home", team: { displayName: "Cleveland Browns" }, records: [{ summary: "0-0" }] },
                { homeAway: "away", team: { displayName: "Green Bay Packers" }, records: [{ summary: "0-0" }] },
              ] }],
            })),
          } } },
        };
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      });
      await page.goto("/profile.html");
      const track = page.locator(".track-dropdown").nth(1);
      const header = track.locator(".track-header");
      await header.click();
      await track.locator(".teamSelection").last().click();
      await expect(track).not.toHaveClass(/expanded/);
      await expect(track.locator(".tempSelection")).toHaveValue("2,Green Bay Packers");
      // Check the settled position, not a transient frame during smooth scrolling.
      await page.waitForTimeout(1000);
      await expect.poll(async () => header.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return box.top >= 0 && box.bottom <= innerHeight;
      })).toBe(true);
      await expect(track.locator(".selected-team-logo")).toHaveCSS("object-fit", "contain");
      await expect(track.locator(".selected-team-logo")).toHaveCSS("flex-shrink", "0");

      // Opening another Track while the collapse is settling must cancel the return.
      await header.click();
      await track.locator(".teamSelection").last().evaluate((button) => {
        window.delayedTrackScrolls = [];
        const scrollIntoView = Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView = function (...args) {
          if (this.matches(".track-header")) window.delayedTrackScrolls.push(this.parentElement.id);
          return scrollIntoView.apply(this, args);
        };
        button.click();
        const nextHeader = document.querySelectorAll(".track-header")[2];
        nextHeader.click();
      });
      await page.waitForTimeout(1000);
      const nextTrack = page.locator(".track-dropdown").nth(2);
      await expect(nextTrack).toHaveClass(/expanded/);
      expect(await page.evaluate(() => window.delayedTrackScrolls)).toEqual([]);
    });
  }
}
