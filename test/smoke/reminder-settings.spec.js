const { expect, test } = require("@playwright/test");

test("email and calendar render when mobile push readiness never resolves", async ({ page }) => {
  await page.addInitScript(() => {
    const neverReady = new Promise(() => {});
    Object.defineProperty(ServiceWorkerContainer.prototype, "ready", {
      configurable: true,
      get: () => neverReady,
    });
  });
  await page.route("**/api/user/reminders/**", async (route) => {
    const url = route.request().url();
    const body = url.endsWith("/push/configuration")
      ? { state: "AVAILABLE", publicKey: "synthetic" }
      : url.endsWith("/email")
        ? { state: "ENABLED", maskedDestination: "u***@example.com" }
        : { state: "AVAILABLE", subscriptionUrl: "https://example.com/calendar.ics", webcalUrl: "webcal://example.com/calendar.ics" };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.goto("/reminder-settings.html");

  await expect(page.locator("#emailStatus")).toHaveText("Enabled");
  await expect(page.locator("#calendarStatus")).toHaveText("Available");
  await expect(page.locator("#pageStatus")).toHaveText("Reminder options loaded.");
});
