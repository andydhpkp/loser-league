const { expect, test } = require("@playwright/test");
test("public email verification and opt-out landings are neutral and accessible", async ({ page }) => {
  const verification = await page.goto(`/reminders/email/verify?token=${"a".repeat(43)}`); expect(verification.headers()["cache-control"]).toBe("no-store"); await expect(page.getByRole("heading", { name: "Email reminder verification" })).toBeVisible(); await expect(page.getByRole("status")).toContainText("verified and enabled");
  const stop = await page.goto(`/reminders/email/stop?token=${"b".repeat(43)}`); expect(stop.headers()["cache-control"]).toBe("no-store"); await expect(page.getByRole("heading", { name: "Email reminders", exact: true })).toBeVisible(); await expect(page.getByRole("status")).toHaveText("Email reminders are off."); await expect(page.getByRole("link", { name: /Log in/ })).toBeVisible();
  const body = await page.locator("body").innerText(); for (const forbidden of ["@", "Track", "Pick", "League Season", "User"]) expect(body).not.toContain(forbidden);
});
