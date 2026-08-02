const { expect, test } = require("@playwright/test");

test("admin records a confirmed solo win from the selected User workspace", async ({
  page,
}) => {
  const writes = [];
  await page.route("**/api/admin/actions/ADD_USER_WIN/**", async (route) => {
    const payload = route.request().postDataJSON();
    if (route.request().url().endsWith("/preview")) {
      writes.push(payload);
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ description: "Record solo win for User 3 in 2025", warnings: [], targets: [{}], confirmationKey: "a".repeat(64) }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ targets: [{ target_type: "USER", after_state: { userRecord: [{ year: 2025, won: true, won_with_tie: false }], crownType: "solo_1" } }] }) });
  });
  await page.route("**/api/users**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: 3,
          first_name: "Example",
          last_name: "User",
          username: "example",
          tracks: [],
          user_record: null,
          crown_type: null,
        },
      ]),
    });
  });
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/admin.html");
  await page.getByRole("button", { name: "Make Changes for a User" }).click();
  await page.locator("#adminUserList").getByRole("button", { name: /Example User/ }).click();
  const yearInput = page.getByLabel("League Season year");
  await expect(yearInput).toHaveAttribute("type", "text");
  await expect(yearInput).toHaveAttribute("inputmode", "numeric");
  await expect(yearInput).toHaveAttribute("pattern", "[0-9]{4}");
  await yearInput.fill("2025");
  await page.getByRole("button", { name: "Add solo win" }).click();

  await expect(page.getByText("2025 solo")).toBeVisible();
  await expect(page.getByText("Crown type: solo_1")).toBeVisible();
  await expect(page.getByText("Win recorded")).toBeVisible();
  expect(writes).toEqual([{ userId: 3, year: 2025, wonWithTie: false }]);
});
