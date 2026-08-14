const { expect, test } = require("@playwright/test");

test("calendar provider instructions are structured inside one collapsed disclosure", async ({ page }) => {
  await page.route("**/api/user/reminders/**", async (route) => {
    const url = route.request().url();
    const body = url.endsWith("/push/configuration")
      ? { state: "TEMPORARILY_UNAVAILABLE", publicKey: null }
      : url.endsWith("/email")
        ? { state: "OFF", maskedDestination: "u***@example.com" }
        : { state: "AVAILABLE", subscriptionUrl: "https://example.com/calendar.ics", webcalUrl: "webcal://example.com/calendar.ics" };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.goto("/reminder-settings.html");

  const disclosure = page.locator("#calendarInstructionDetails");
  await expect(disclosure).not.toHaveAttribute("open", "");
  await expect(page.locator("#calendarLimitations")).toBeVisible();
  expect(await disclosure.locator("#calendarLimitations").count()).toBe(0);

  await disclosure.locator("summary").click();
  await expect(disclosure.getByRole("heading", { name: "Apple Calendar" })).toBeVisible();
  await expect(disclosure.getByRole("heading", { name: "Google Calendar" })).toBeVisible();
  await expect(disclosure.getByRole("heading", { name: "Outlook" })).toBeVisible();
  await expect(disclosure.locator(".calendar-provider-instructions")).toHaveCount(3);
  await expect(disclosure.getByText("Subscribe", { exact: true })).toHaveCount(3);
  await expect(disclosure.getByText("Remove", { exact: true })).toHaveCount(3);
});
