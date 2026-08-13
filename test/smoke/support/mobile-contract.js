const { expect } = require("@playwright/test");

const syntheticUsers = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  first_name: index === 0 ? "Alexandria-Cassandra" : `User${index + 1}`,
  last_name: index === 0 ? "Extraordinarily-Long-Synthetic-Name" : "Example",
  username: `synthetic-user-${index + 1}`,
  user_record: [],
  tracks: Array.from({ length: index === 0 ? 8 : 2 }, (_, trackIndex) => ({
    id: index * 10 + trackIndex + 1,
    wrong_pick: null,
  })),
}));

async function installSyntheticApi(page) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    let body = {};
    if (url.endsWith("/api/users")) body = syntheticUsers;
    else if (url.includes("/api/users/logged")) body = { id: 1 };
    else if (url.includes("/api/user/dashboard")) body = {
      leagueSeason: { year: 2026, week: 2, state: "ACTIVE" },
      deadline: { available: true, timestamp: "2026-09-17T00:00:00.000Z" },
      tracks: { active: 8, missingPicks: 4 },
      makePicks: { code: "PICKS_REQUIRED", label: "4 Picks still needed" },
      features: { pickReminders: false },
    };
    else if (url.includes("/api/user/league/support")) body = { contacts: [] };
    else if (url.includes("/api/user/league/submission")) body = {
      leagueSeason: { id: 1, year: 2026, week: 2, state: "ACTIVE" },
      tracks: [],
      onboarding: {
        enrollmentOpen: true,
        price: "$5",
        contacts: [{ name: "Synthetic Commissioner", formattedPhone: "(555) 010-0101", smsUrl: "sms:+15550100101" }],
        payment: { handle: "@SyntheticLeague", url: "https://example.com/payment" },
      },
    };
    else if (url.includes("/api/user/league/view")) body = {
      leagueSeason: { id: 1, year: 2026, week: 2 },
      pickVisibility: "VISIBLE",
      users: [],
    };
    else if (url.includes("/api/admin/league-season")) body = {
      leagueSeason: { id: 1, year: 2026, week: 2, state: "ACTIVE", stateVersion: 1 },
      unassignedTrackCount: 0,
    };
    else if (url.includes("/api/proxy/nfl")) body = [];
    else if (route.request().method() === "GET") body = [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

async function expectNoDocumentOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function expectTouchTargets(page, selector) {
  const undersized = await page.locator(selector).evaluateAll((elements) => elements
    .filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    })
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return { label: element.getAttribute("aria-label") || element.textContent.trim() || element.id, width: rect.width, height: rect.height };
    })
    .filter(({ width, height }) => width < 44 || height < 44));
  expect(undersized).toEqual([]);
}

async function expectVisibleContentWithinViewport(page, selector) {
  const outside = await page.locator(selector).evaluateAll((elements) => elements
    .filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    })
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return { label: element.getAttribute("aria-label") || element.textContent.trim().slice(0, 60) || element.id, left: rect.left, right: rect.right };
    })
    .filter(({ left, right }) => left < -1 || right > document.documentElement.clientWidth + 1));
  expect(outside).toEqual([]);
}

module.exports = {
  expectNoDocumentOverflow,
  expectTouchTargets,
  expectVisibleContentWithinViewport,
  installSyntheticApi,
};
