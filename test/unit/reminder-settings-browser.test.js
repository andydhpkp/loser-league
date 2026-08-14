const assert = require("node:assert/strict");
const test = require("node:test");

test("settings loads channel contracts independently and preserves partial success", async () => {
  const { loadChannelStatuses } = await import("../../public/js/modules/reminder-settings.js");
  const result = await loadChannelStatuses(async (url) => {
    if (url.endsWith("/email")) return { ok: false, status: 503, json: async () => ({}) };
    if (url.endsWith("/calendar")) return { ok: true, status: 200, json: async () => ({ state: "AVAILABLE", subscriptionUrl: "https://example.invalid/calendar/pick-deadlines.ics", webcalUrl: "webcal://example.invalid/calendar/pick-deadlines.ics" }) };
    return { ok: true, status: 200, json: async () => ({ state: "AVAILABLE", publicKey: "safe-public-key" }) };
  });
  assert.equal(result.push.value.state, "AVAILABLE");
  assert.equal(result.email.error, "UNAVAILABLE");
  assert.equal(result.calendar.value.state, "AVAILABLE");
});

test("settings treats an expired session as page-wide authority loss", async () => {
  const { loadChannelStatuses } = await import("../../public/js/modules/reminder-settings.js");
  await assert.rejects(loadChannelStatuses(async () => ({ ok: false, status: 401 })), /SESSION_EXPIRED/);
});

test("push permission is requested only by the explicit enable operation", async () => {
  const { enablePushOnDevice } = await import("../../public/js/modules/reminder-settings.js");
  let permissions = 0;
  const result = await enablePushOnDevice({
    configuration: { state: "AVAILABLE", publicKey: "AQID" },
    notificationApi: { permission: "default", requestPermission: async () => { permissions += 1; return "denied"; } },
  });
  assert.equal(permissions, 1);
  assert.deepEqual(result, { state: "PERMISSION_DENIED" });
});
