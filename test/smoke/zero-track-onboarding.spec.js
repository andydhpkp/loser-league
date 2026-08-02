const { expect, test } = require("@playwright/test");

test("authenticated zero-Track profile renders accessible payment, help, and refresh actions", async ({ page }) => {
  let submissionRequests = 0;
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    let body = {};
    if (url.includes("/api/user/league/submission")) {
      submissionRequests += 1;
      body = {
        leagueSeason: { id: 1, year: 2026, week: 0, state: "SETUP" },
        tracks: [],
        onboarding: {
          enrollmentOpen: true,
          price: "$5",
          contacts: [
            { name: "Tate", formattedPhone: "(303) 555-0101", smsUrl: "sms:+13035550101" },
            { name: "Andrew", formattedPhone: "(720) 555-0102", smsUrl: "sms:+17205550102" },
          ],
          payment: { handle: "@TateBenson28", url: "https://account.venmo.com/u/TateBenson28" },
        },
      };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.goto("/profile.html");
  await expect(page.getByRole("heading", { name: "Ready to play?" })).toBeVisible();
  await expect(page.getByText("Tracks are $5 each", { exact: false })).toBeVisible();
  const payment = page.getByRole("link", { name: "Pay Tate on Venmo (@TateBenson28)" });
  await expect(payment).toHaveAttribute("href", "https://account.venmo.com/u/TateBenson28");
  await expect(payment).toHaveAttribute("target", "_blank");
  await expect(payment).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.getByRole("link", { name: "Text Tate for help" })).toHaveAttribute("href", "sms:+13035550101");
  await expect(page.getByText("(303) 555-0101", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Text Andrew for help" })).toHaveAttribute("href", "sms:+17205550102");
  await expect(page.getByRole("button", { name: "Refresh Tracks" })).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.getByRole("button", { name: "Refresh Tracks" }).click();
  await expect.poll(() => submissionRequests).toBeGreaterThanOrEqual(2);
});

test("closed zero-Track profile omits payment and keeps help contacts", async ({ page }) => {
  await page.route("**/api/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      leagueSeason: { id: 1, year: 2026, week: 2, state: "ACTIVE" },
      tracks: [],
      onboarding: {
        enrollmentOpen: false,
        price: "$5",
        contacts: [{ name: "Tate", formattedPhone: "(303) 555-0101", smsUrl: "sms:+13035550101" }],
        payment: { handle: "@TateBenson28", url: "https://account.venmo.com/u/TateBenson28" },
      },
    }),
  }));
  await page.goto("/profile.html");
  await expect(page.getByRole("heading", { name: "Track enrollment is closed" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Pay Tate/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Text Tate for help" })).toBeVisible();
});

test("unavailable League Season error includes configured help numbers", async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    if (route.request().url().includes("/api/user/league/support")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ contacts: [
        { name: "Tate", formattedPhone: "(303) 555-0101", smsUrl: "sms:+13035550101" },
        { name: "Andrew", formattedPhone: "(720) 555-0102", smsUrl: "sms:+17205550102" },
      ] }) });
    }
    return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "CONFLICT", message: "No open League Season exists" }) });
  });

  await page.goto("/profile.html");
  await expect(page.getByText("Unable to load your Tracks. Please refresh and try again.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Text Tate for help" })).toHaveAttribute("href", "sms:+13035550101");
  await expect(page.getByText("(303) 555-0101", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Text Andrew for help" })).toHaveAttribute("href", "sms:+17205550102");
  await expect(page.getByText("(720) 555-0102", { exact: false })).toBeVisible();
});
