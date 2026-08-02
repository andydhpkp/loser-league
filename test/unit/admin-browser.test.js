const assert = require("node:assert/strict");
const { test } = require("node:test");

test("admin formats a nullable User win record as no wins", async () => {
  const { formatUserWinHistory } = await import(
    "../../public/js/modules/admin-management.js"
  );

  assert.equal(formatUserWinHistory(null), "No wins recorded");
});

test("admin login sends the shared password only to the server", async () => {
  const calls = [];
  const { loginAdmin } = await import(
    "../../public/js/modules/admin-management.js"
  );

  await loginAdmin("submitted-password", async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 204 };
  });

  assert.deepEqual(calls, [
    {
      url: "/api/admin/login",
      options: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "submitted-password" }),
      },
    },
  ]);
});

test("admin logout clears the server-owned admin session", async () => {
  const calls = [];
  const { logoutAdmin } = await import(
    "../../public/js/modules/admin-management.js"
  );

  await logoutAdmin(async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 204 };
  });

  assert.deepEqual(calls, [
    {
      url: "/api/admin/logout",
      options: { method: "POST" },
    },
  ]);
});

test("admin confirms and records a solo League Season win", async () => {
  const confirmations = [];
  const calls = [];
  const responseBody = { targets: [{ target_type: "USER", after_state: { userRecord: [{ year: 2025, won: true, won_with_tie: false }], crownType: "solo_1" } }] };
  const previewBody = { description: "Record solo win for User 3 in 2025", warnings: [], targets: [{}], confirmationKey: "a".repeat(64) };
  const { addUserWin } = await import(
    "../../public/js/modules/admin-management.js"
  );

  const result = await addUserWin(
    {
      userId: 3,
      displayName: "Example User",
      year: "2025",
      wonWithTie: false,
    },
    {
      confirmImpl(message) {
        confirmations.push(message);
        return true;
      },
      async fetchImpl(url, options) {
        calls.push({ url, options });
        return { ok: true, json: async () => calls.length === 1 ? previewBody : responseBody };
      },
    }
  );

  assert.deepEqual(confirmations, [
    "Record solo win for User 3 in 2025 (Example User)\nAffected records: 1\n",
  ]);
  assert.deepEqual(calls, [
    {
      url: "/api/admin/actions/ADD_USER_WIN/preview",
      options: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: 3, year: 2025, wonWithTie: false }),
      },
    },
    {
      url: "/api/admin/actions/ADD_USER_WIN/confirm",
      options: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmationKey: "a".repeat(64) }) },
    },
  ]);
  assert.deepEqual(result, { user_record: responseBody.targets[0].after_state.userRecord, crown_type: "solo_1" });
});

test("admin win workflow rejects an invalid League Season year before confirmation", async () => {
  let confirmationCalls = 0;
  let fetchCalls = 0;
  const { addUserWin } = await import(
    "../../public/js/modules/admin-management.js"
  );

  await assert.rejects(
    addUserWin(
      {
        userId: 3,
        displayName: "Example User",
        year: "",
        wonWithTie: false,
      },
      {
        confirmImpl() {
          confirmationCalls += 1;
          return true;
        },
        async fetchImpl() {
          fetchCalls += 1;
          return { ok: true, json: async () => ({}) };
        },
      }
    ),
    /four-digit League Season year/
  );

  assert.equal(confirmationCalls, 0);
  assert.equal(fetchCalls, 0);
});

test("admin can cancel a tied win after preview without confirmation", async () => {
  let fetchCalls = 0;
  const { addUserWin } = await import(
    "../../public/js/modules/admin-management.js"
  );

  const result = await addUserWin(
    {
      userId: 3,
      displayName: "Example User",
      year: "2025",
      wonWithTie: true,
    },
    {
      confirmImpl(message) {
        assert.match(message, /Record tied win/);
        return false;
      },
      async fetchImpl() {
        fetchCalls += 1;
        return { ok: true, json: async () => ({ description: "Record tied win", warnings: [], targets: [{}], confirmationKey: "a".repeat(64) }) };
      },
    }
  );

  assert.equal(result, null);
  assert.equal(fetchCalls, 1);
});

test("admin tied win sends the tied flag and maps server failure safely", async () => {
  const payloads = [];
  const { addUserWin } = await import(
    "../../public/js/modules/admin-management.js"
  );

  await assert.rejects(
    addUserWin(
      {
        userId: 3,
        displayName: "Example User",
        year: "2025",
        wonWithTie: true,
      },
      {
        confirmImpl: () => true,
        async fetchImpl(_url, options) {
          payloads.push(JSON.parse(options.body));
          return { ok: false, status: 500 };
        },
      }
    ),
    /Unable to preview admin action/
  );
  assert.deepEqual(payloads, [{ userId: 3, year: 2025, wonWithTie: true }]);
});

test("admin official-result and manual-close workflows use registered preview and confirmation", async () => {
  const { overrideGameResult, closeCurrentWeek } = await import("../../public/js/modules/admin-management.js");
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    if (url.endsWith("/preview")) return { ok: true, json: async () => ({ description: "Preview", warnings: [], targets: [{}], unfinishedUnselectedGames: [{ homeTeam: "Chiefs", awayTeam: "Chargers" }], confirmationKey: "a".repeat(64) }) };
    return { ok: true, json: async () => ({ action: "COMMITTED", targets: [] }) };
  };

  await overrideGameResult({ homeTeam: "Broncos", awayTeam: "Raiders", homeScore: 13, awayScore: 20, explanation: "Official announcement", sourceUrl: "" }, { fetchImpl, confirmImpl: () => true });
  await closeCurrentWeek("All selected games are official", { fetchImpl, confirmImpl: (message) => message.includes("Chiefs vs Chargers") });

  assert.deepEqual(calls, [
    { url: "/api/admin/actions/OVERRIDE_GAME_RESULT/preview", body: { homeTeam: "Broncos", awayTeam: "Raiders", homeScore: 13, awayScore: 20, explanation: "Official announcement", sourceUrl: "" } },
    { url: "/api/admin/actions/OVERRIDE_GAME_RESULT/confirm", body: { confirmationKey: "a".repeat(64) } },
    { url: "/api/admin/actions/CLOSE_WEEK/preview", body: {} },
    { url: "/api/admin/actions/CLOSE_WEEK/confirm", body: { confirmationKey: "a".repeat(64), note: "All selected games are official" } },
  ]);
});

test("guided repairs use registered actions and carry destructive confirmation phrases", async () => {
  const {
    inspectAdminTrack,
    resetCurrentPicks,
    assignCurrentPick,
    replaceCurrentPick,
    reactivateTrack,
    resetPlayoffPickPools,
  } = await import("../../public/js/modules/admin-management.js");
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, body: options.body ? JSON.parse(options.body) : undefined });
    if (!options.method) return { ok: true, json: async () => ({ track: { id: 9 } }) };
    if (url.endsWith("/preview")) return { ok: true, json: async () => ({ description: "Preview", warnings: [], targets: [{}], confirmationKey: "a".repeat(64) }) };
    return { ok: true, json: async () => ({ action: "COMMITTED", targets: [] }) };
  };
  const options = { fetchImpl, confirmImpl: () => true };

  await inspectAdminTrack(9, fetchImpl);
  await resetCurrentPicks({ scope: "ALL" }, { ...options, confirmationPhrase: "RESET EVERY TRACK" });
  await assignCurrentPick({ trackId: 9, teamName: "Broncos" }, options);
  await replaceCurrentPick({ trackId: 9, teamName: "Raiders" }, options);
  await reactivateTrack({ trackId: 9, paymentConfirmed: true }, options);
  await resetPlayoffPickPools({ ...options, confirmationPhrase: "RESET PICKS FOR PLAYOFFS" });

  assert.deepEqual(calls, [
    { url: "/api/admin/repairs/tracks/9", body: undefined },
    { url: "/api/admin/actions/RESET_CURRENT_PICKS/preview", body: { scope: "ALL" } },
    { url: "/api/admin/actions/RESET_CURRENT_PICKS/confirm", body: { confirmationKey: "a".repeat(64), confirmationPhrase: "RESET EVERY TRACK" } },
    { url: "/api/admin/actions/ASSIGN_CURRENT_PICK/preview", body: { trackId: 9, teamName: "Broncos" } },
    { url: "/api/admin/actions/ASSIGN_CURRENT_PICK/confirm", body: { confirmationKey: "a".repeat(64) } },
    { url: "/api/admin/actions/REPLACE_CURRENT_PICK/preview", body: { trackId: 9, teamName: "Raiders" } },
    { url: "/api/admin/actions/REPLACE_CURRENT_PICK/confirm", body: { confirmationKey: "a".repeat(64) } },
    { url: "/api/admin/actions/REACTIVATE_TRACK/preview", body: { trackId: 9, paymentConfirmed: true } },
    { url: "/api/admin/actions/REACTIVATE_TRACK/confirm", body: { confirmationKey: "a".repeat(64) } },
    { url: "/api/admin/actions/RESET_PLAYOFF_PICK_POOLS/preview", body: {} },
    { url: "/api/admin/actions/RESET_PLAYOFF_PICK_POOLS/confirm", body: { confirmationKey: "a".repeat(64), confirmationPhrase: "RESET PICKS FOR PLAYOFFS" } },
  ]);
});
