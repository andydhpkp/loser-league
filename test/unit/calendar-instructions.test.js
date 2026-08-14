const test = require("node:test");
const assert = require("node:assert/strict");

test("calendar instruction contract is honest and covers subscribe and removal", async () => {
  const { CALENDAR_INSTRUCTIONS, calendarLinks } = await import("../../public/js/modules/calendar-instructions.js");
  assert.deepEqual(calendarLinks("https://example.invalid/calendar/pick-deadlines.ics"), { https: "https://example.invalid/calendar/pick-deadlines.ics", webcal: "webcal://example.invalid/calendar/pick-deadlines.ics" });
  for (const family of ["apple", "google", "outlook"]) {
    assert.match(CALENDAR_INSTRUCTIONS[family].subscribe, /subscribe|subscription|URL/i);
    assert.match(CALENDAR_INSTRUCTIONS[family].remove, /unsubscribe|remove/i);
  }
  assert.match(CALENDAR_INSTRUCTIONS.limitations, /(change|changed).*ignore.*24-hour alert|24-hour alert.*(change|changed).*ignore/i);
  assert.match(CALENDAR_INSTRUCTIONS.limitations, /after.*Picks.*complete/i);
  assert.match(CALENDAR_INSTRUCTIONS.limitations, /cannot detect/i);
});
