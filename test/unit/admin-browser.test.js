const assert = require("node:assert/strict");
const { test } = require("node:test");

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
  const responseBody = {
    user_record: [{ year: 2025, won: true, won_with_tie: false }],
    crown_type: "solo_1",
  };
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
        return { ok: true, json: async () => responseBody };
      },
    }
  );

  assert.deepEqual(confirmations, [
    "Add a solo win for Example User for the 2025 League Season?",
  ]);
  assert.deepEqual(calls, [
    {
      url: "/api/users/3/add-win",
      options: {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: 2025, won_with_tie: false }),
      },
    },
  ]);
  assert.deepEqual(result, responseBody);
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

test("admin can cancel a tied win before any request is sent", async () => {
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
        assert.equal(
          message,
          "Add a tied win for Example User for the 2025 League Season?"
        );
        return false;
      },
      async fetchImpl() {
        fetchCalls += 1;
        return { ok: true, json: async () => ({}) };
      },
    }
  );

  assert.equal(result, null);
  assert.equal(fetchCalls, 0);
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
    /Unable to add win/
  );
  assert.deepEqual(payloads, [{ year: 2025, won_with_tie: true }]);
});
