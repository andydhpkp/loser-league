const { expect, test } = require("@playwright/test");

test("admin records a confirmed solo win from the existing User modal", async ({
  page,
}) => {
  const writes = [];
  await page.route("**/api/users**", async (route) => {
    if (route.request().method() === "PUT") {
      writes.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user_record: [
            { year: 2025, won: true, won_with_tie: false },
          ],
          crown_type: "solo_1",
        }),
      });
      return;
    }

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
  await page.getByRole("link", { name: "Example" }).click();
  const yearInput = page.getByLabel("League Season year");
  await expect(yearInput).toHaveAttribute("type", "text");
  await expect(yearInput).toHaveAttribute("inputmode", "numeric");
  await expect(yearInput).toHaveAttribute("pattern", "[0-9]{4}");
  await yearInput.fill("2025");
  await page.getByRole("button", { name: "Add solo win" }).click();

  await expect(page.getByText("2025 solo")).toBeVisible();
  await expect(page.getByText("Crown type: solo_1")).toBeVisible();
  await expect(page.getByText("Win recorded")).toBeVisible();
  expect(writes).toEqual([{ year: 2025, won_with_tie: false }]);
});
