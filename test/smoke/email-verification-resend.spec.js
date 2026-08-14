const { expect, test } = require("@playwright/test");

test("pending email verification counts down and resends with confirmation", async ({ page }) => {
  let retryAfterSeconds = 1;
  await page.route("**/api/user/reminders/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("/email/verification-requests")) {
      retryAfterSeconds = 600;
      return route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ state: "VERIFICATION_PENDING", retryAfterSeconds, message: "Verification email sent. Check your inbox and spam folder. The link expires in 24 hours." }) });
    }
    const body = url.endsWith("/push/configuration")
      ? { state: "TEMPORARILY_UNAVAILABLE", publicKey: null }
      : url.endsWith("/email")
        ? { state: "VERIFICATION_PENDING", maskedDestination: "u***@example.test", retryAfterSeconds, hasPreviousRequest: true }
        : { state: "TEMPORARILY_UNAVAILABLE" };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.goto("/reminder-settings.html");
  const resend = page.locator("#verifyEmail");
  await expect(resend).toBeVisible();
  await expect(resend).toBeDisabled();
  await expect(resend).toHaveText("Resend available in 0:01");
  await expect(resend).toBeEnabled({ timeout: 2_500 });
  await expect(resend).toHaveText("Resend verification email");
  await resend.click();
  await expect(page.locator("#emailConfirmation")).toHaveText("Verification email sent. Check your inbox and spam folder. The link expires in 24 hours.");
  await expect(resend).toBeDisabled();
  await expect(resend).toHaveText("Resend available in 10:00");
});
