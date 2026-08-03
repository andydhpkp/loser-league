const { expect, test } = require("@playwright/test");

const users = [
  { id: 3, first_name: "Alice", last_name: "Able", username: "alice", user_record: [], tracks: [{ id: 31, league_season_id: 1, current_pick: "Broncos", wrong_pick: null, eliminated_by_pick_id: null }] },
  { id: 4, first_name: "Bob", last_name: "Baker", username: "bob", user_record: [], tracks: [{ id: 41, league_season_id: 1, current_pick: "Raiders", wrong_pick: "Raiders", eliminated_by_pick_id: 9 }] },
];

function inspectedTrack(id, currentPick = "Broncos") {
  return {
    user: { id: 3, displayName: "Alice Able", username: "alice" },
    track: { id, active: true, stateVersion: 1, eliminatingPickId: null },
    leagueSeason: { id: 1, year: 2026, state: "ACTIVE", week: 1, pickCycle: 1, stateVersion: 1 },
    picks: [],
    projections: { currentPick, usedPicks: currentPick ? [currentPick] : [], availablePicks: ["Raiders"], wrongPick: null },
    eligibleCurrentWeekTeams: ["Raiders"], inconsistencies: [], reactivations: [], recentOperations: [],
  };
}

test.beforeEach(async ({ page }) => {
  let listedUsers = [...users];
  let aliceTracks = [inspectedTrack(31)];
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("/api/users")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(listedUsers) });
    if (url.endsWith("/api/admin/users/3/workspace")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: users[0], tracks: aliceTracks }) });
    if (url.includes("/api/admin/actions/DELETE_TRACK/preview")) return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ description: "Delete Track", targets: [{}], warnings: [], confirmationKey: "a".repeat(64) }) });
    if (url.includes("/api/admin/actions/DELETE_TRACK/confirm")) { aliceTracks = []; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ action: "DELETE_TRACK", targets: [] }) }); }
    if (url.includes("/api/admin/actions/REPLACE_CURRENT_PICK/preview")) return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ description: "Replace Pick", targets: [{}], warnings: [], confirmationKey: "a".repeat(64) }) });
    if (url.includes("/api/admin/actions/REPLACE_CURRENT_PICK/confirm")) { aliceTracks = [inspectedTrack(31, "Raiders")]; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ action: "REPLACE_CURRENT_PICK", targets: [] }) }); }
    if (url.includes("/api/admin/actions/DELETE_USER/preview")) return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ description: "Delete User", targets: [{}], warnings: [], confirmationKey: "a".repeat(64) }) });
    if (url.includes("/api/admin/actions/DELETE_USER/confirm")) { listedUsers = listedUsers.filter((user) => user.id !== 3); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ action: "DELETE_USER", targets: [] }) }); }
    if (url.endsWith("/api/admin/league-season")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ leagueSeason: { id: 1, year: 2026, state: "ACTIVE", week: 1, stateVersion: 1 }, unassignedTrackCount: 0 }) });
    if (url.includes("/api/admin/tracks/bulk")) return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ totalCreated: 5 }) });
    if (url.endsWith("/api/proxy/nfl-odds")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ bookmakers: [{ markets: [{ outcomes: [{ name: "Broncos", point: -7 }, { name: "Raiders", point: 7 }] }] }] }]) });
    if (url.includes("/api/proxy/nfl")) return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ decisions: [] }) });
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/admin.html");
});

test("admin home opens focused workflows with contextual help", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "What do you need to do?" })).toBeVisible();
  await page.getByRole("button", { name: "Make Changes for a User" }).click();
  await expect(page.getByRole("heading", { name: "Make Changes for a User" })).toBeVisible();
  await expect(page.locator("#adminUserList").getByText("Alice Able")).toBeVisible();
  await page.getByRole("button", { name: "Help" }).click();
  await expect(page.getByRole("dialog")).toContainText("Search for the User by name or username");
});

test("deleting a Track refreshes the selected User workspace without navigating away", async ({ page }) => {
  let workspaceReads = 0;
  page.on("request", (request) => { if (request.url().endsWith("/api/admin/users/3/workspace")) workspaceReads += 1; });
  await page.getByRole("button", { name: "Make Changes for a User" }).click();
  await page.getByRole("button", { name: /Alice Able/ }).click();
  await page.getByRole("button", { name: /Track 1 Active/ }).click();
  await page.getByRole("button", { name: "Delete Track 1" }).click();
  await expect(page.getByRole("heading", { name: /Alice Able/ })).toBeVisible();
  await expect(page.locator("#adminUserWorkspaceStatus")).toContainText("Track 1 deleted.");
  await expect(page.getByRole("button", { name: /Track 1 Active/ })).toHaveCount(0);
  expect(workspaceReads).toBe(2);
});

test("a successful Pick mutation refreshes and preserves the selected Track", async ({ page }) => {
  await page.getByRole("button", { name: "Make Changes for a User" }).click();
  await page.getByRole("button", { name: /Alice Able/ }).click();
  await page.getByRole("button", { name: /Track 1 Active/ }).click();
  await page.getByLabel("Valid Team for Track 1").selectOption("Raiders");
  await page.getByRole("button", { name: "Replace current Pick" }).click();
  await expect(page.locator("#adminUserWorkspaceStatus")).toContainText("Pick updated.");
  await expect(page.getByRole("heading", { name: "Track 1 actions" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Track 1 Active Current Pick: Raiders/ })).toBeVisible();
});

test("a failed mutation restores controls and preserves User and Track selection", async ({ page }) => {
  await page.route("**/api/admin/actions/REPLACE_CURRENT_PICK/preview", (route) => route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ message: "Track changed; refresh and review it." }) }));
  await page.getByRole("button", { name: "Make Changes for a User" }).click();
  await page.getByRole("button", { name: /Alice Able/ }).click();
  await page.getByRole("button", { name: /Track 1 Active/ }).click();
  await page.getByLabel("Valid Team for Track 1").selectOption("Raiders");
  const replace = page.getByRole("button", { name: "Replace current Pick" });
  await replace.click();
  await expect(page.getByRole("heading", { name: /Alice Able/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Track 1 actions" })).toBeVisible();
  await expect(replace).toBeEnabled();
  await expect(page.getByRole("status").last()).toContainText("Unable to preview admin action");
});

test("a pending mutation disables affected controls and announces progress", async ({ page }) => {
  await page.route("**/api/admin/actions/REPLACE_CURRENT_PICK/confirm", () => new Promise(() => {}));
  await page.getByRole("button", { name: "Make Changes for a User" }).click();
  await page.getByRole("button", { name: /Alice Able/ }).click();
  await page.getByRole("button", { name: /Track 1 Active/ }).click();
  await page.getByLabel("Valid Team for Track 1").selectOption("Raiders");
  const replace = page.getByRole("button", { name: "Replace current Pick" });
  await replace.click();
  await expect(replace).toBeDisabled();
  await expect(page.getByRole("status").last()).toHaveText("Updating…");
});

test("deleting a User preserves the search and returns to the filtered list", async ({ page }) => {
  await page.getByRole("button", { name: "Make Changes for a User" }).click();
  const search = page.getByLabel("Find a User");
  await search.fill("Alice");
  await page.getByRole("button", { name: /Alice Able/ }).click();
  await page.getByText("Danger Zone", { exact: true }).click();
  await page.getByRole("button", { name: "Delete Alice Able" }).click();
  await expect(search).toHaveValue("Alice");
  await expect(page.locator("#adminUserList").getByText("Alice Able")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("User deleted.");
});

test("View Statistics opens the detailed weekly modal and loads riskiest Pick odds", async ({ page }) => {
  await page.getByRole("button", { name: "View Statistics" }).click();
  const modal = page.getByRole("dialog", { name: "Weekly Statistics" });
  await expect(modal).toBeVisible();
  await expect(modal).toContainText("Most Popular Pick");
  await expect(modal).toContainText("Users Eliminated");
  await expect(modal).toContainText("Tracks Left");
  await expect(modal).toContainText("Alice Able (1 Track)");
  await modal.getByRole("button", { name: "Reload Game Odds" }).click();
  await expect(modal).toContainText("Alice Able: Broncos (Spread: -7)");
});

test("odds failure leaves base statistics visible with an inline status", async ({ page }) => {
  await page.route("**/api/proxy/nfl-odds", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "unavailable" }) }));
  await page.getByRole("button", { name: "View Statistics" }).click();
  const modal = page.getByRole("dialog", { name: "Weekly Statistics" });
  await modal.getByRole("button", { name: "Reload Game Odds" }).click();
  await expect(modal).toContainText("Odds unavailable");
  await expect(modal).toContainText("Most Popular Pick");
});

for (const [workflow, title, expectedAction] of [
  ["Make Changes for a User", "Make Changes for a User", "Assign current Pick"],
  ["Add Tracks in Bulk", "Add Tracks in Bulk", "The entire submission is atomic"],
  ["Manage Week and League Season", "Manage Week and League Season", "Official game result override"],
  ["Manage Buybacks", "Manage Buybacks", "Pending requests"],
]) {
  test(`${workflow} Help is a complete operational guide`, async ({ page }) => {
    await page.getByRole("button", { name: workflow }).click();
    await page.getByRole("button", { name: "Help" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: title })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "What this workflow is for" })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Warnings" })).toBeVisible();
    await expect(dialog).toContainText(expectedAction);
  });
}

test("bulk Track workflow previews and submits quantities for multiple Users", async ({ page }) => {
  const requests = [];
  page.on("request", (request) => { if (request.url().includes("/api/admin/tracks/bulk")) requests.push(request.postDataJSON()); });
  await page.getByRole("button", { name: "Add Tracks in Bulk" }).click();
  await page.getByLabel("Tracks for Alice Able").fill("2");
  await page.getByLabel("Tracks for Bob Baker").fill("3");
  await page.getByRole("button", { name: "Add Tracks" }).click();
  await expect(page.locator("#bulkTrackPreview")).toContainText("5 Tracks created");
  expect(requests).toEqual([{ additions: [{ userId: 3, quantity: 2 }, { userId: 4, quantity: 3 }] }]);
});

test("raw database identifiers are not presented as admin inputs", async ({ page }) => {
  await expect(page.getByLabel("Track ID")).toHaveCount(0);
  await expect(page.getByLabel("Pick ID")).toHaveCount(0);
  await expect(page.getByLabel("User ID")).toHaveCount(0);
  await expect(page.getByLabel("State version")).toHaveCount(0);
});

test("admin controls retain the established Bootstrap button treatment", async ({ page }) => {
  const background = await page.locator("#officialResultForm .btn-warning").evaluate(
    (button) => getComputedStyle(button).backgroundColor
  );
  expect(background).toBe("rgb(255, 193, 7)");
});

test("admin buttons never use secondary Bootstrap treatments", async ({ page }) => {
  await expect(page.locator("button.btn-secondary, button.btn-outline-secondary")).toHaveCount(0);
});

test("admin buttons use filled Bootstrap treatments for readable contrast", async ({ page }) => {
  await expect(page.locator("button[class*='btn-outline-']")).toHaveCount(0);
  await page.getByRole("button", { name: "Make Changes for a User" }).click();
  await page.getByRole("button", { name: /Alice Able/ }).click();
  await expect(page.getByRole("button", { name: "Add solo win" })).toHaveClass(/btn-primary/);
  await expect(page.getByRole("button", { name: "Add tied win" })).toHaveClass(/btn-primary/);
  await expect(page.getByRole("button", { name: "Manage this User's buyback" })).toHaveClass(/btn-warning/);
  await expect(page.locator("button[class*='btn-outline-']")).toHaveCount(0);
});

test("admin action buttons name the eventual change instead of a preview step", async ({ page }) => {
  await expect(page.getByRole("button", { name: /preview/i })).toHaveCount(0);
});

test("empty League Season state offers year creation without loading the NFL feed", async ({ page }) => {
  let nflRequests = 0;
  await page.route("**/api/admin/league-season", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ leagueSeason: null, unassignedTrackCount: 0 }) }));
  page.on("request", (request) => { if (request.url().includes("/api/proxy/nfl")) nflRequests += 1; });
  await page.reload();
  await page.getByRole("button", { name: "Manage Week and League Season" }).click();
  await expect(page.getByRole("heading", { name: "Create League Season" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Official game result override" })).toBeHidden();
  expect(nflRequests).toBe(0);
});

test("SETUP Week 0 offers an explicit Start Week 1 action without loading the NFL feed", async ({ page }) => {
  let nflRequests = 0;
  await page.route("**/api/admin/league-season", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ leagueSeason: { id: 1, year: 2026, state: "SETUP", week: 0, stateVersion: 0 }, unassignedTrackCount: 0 }) }));
  page.on("request", (request) => { if (request.url().includes("/api/proxy/nfl")) nflRequests += 1; });
  await page.reload();
  await page.getByRole("button", { name: "Manage Week and League Season" }).click();
  await expect(page.getByRole("button", { name: "Start Week 1" })).toBeVisible();
  expect(nflRequests).toBe(0);
});

test("admin logout stays centered at the bottom of the page", async ({ page }) => {
  const alignment = await page.locator("footer").evaluate(
    (footer) => getComputedStyle(footer).textAlign
  );
  expect(alignment).toBe("center");
});

test("workflow back navigation uses a filled Bootstrap button treatment", async ({ page }) => {
  await page.getByRole("button", { name: "Manage Buybacks" }).click();
  const back = page.getByRole("button", { name: "Back to Admin Home" });
  await expect(back).toHaveClass(/btn-primary/);
  await expect(back).toHaveCSS("text-decoration-line", "none");
  await expect(page.locator("#adminBottomNavigation + footer")).toHaveCount(1);
  await expect(page.locator("#adminBottomNavigation button")).toHaveText(["Help", "← Back to Admin Home"]);
});
