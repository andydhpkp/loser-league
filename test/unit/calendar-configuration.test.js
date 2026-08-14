const test = require("node:test");
const assert = require("node:assert/strict");
const { buildCalendarConfiguration } = require("../../server/modules/calendar/calendar-configuration");

test("calendar configuration accepts only one exact HTTPS public origin", () => {
  assert.deepEqual(buildCalendarConfiguration({}), { ready: false, publicAppOrigin: null, feedUrl: null, dashboardUrl: null, invalidSettings: [] });
  assert.deepEqual(buildCalendarConfiguration({ PUBLIC_APP_ORIGIN: "https://example.invalid/path" }).invalidSettings, ["PUBLIC_APP_ORIGIN"]);
  const value = buildCalendarConfiguration({ PUBLIC_APP_ORIGIN: "https://example.invalid" });
  assert.equal(value.feedUrl, "https://example.invalid/calendar/pick-deadlines.ics"); assert.equal(value.dashboardUrl, "https://example.invalid/dashboard.html");
});
