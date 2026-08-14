const test = require("node:test");
const assert = require("node:assert/strict");

const { serializeCalendar, stableEventUid } = require("../../server/modules/calendar/calendar-serializer");

test("calendar serializer emits deterministic RFC 5545 content with safe generic events", () => {
  const event = {
    uid: stableEventUid({ year: 2026, phase: "REGULAR", round: 1 }),
    deadline: new Date("2026-09-10T23:30:00.000Z"),
    sequence: 2,
    revisedAt: new Date("2026-08-13T12:00:00.000Z"),
    status: "CONFIRMED",
  };
  const body = serializeCalendar({ events: [event], dashboardUrl: "https://example.invalid/dashboard.html" });

  assert.equal(body.endsWith("\r\n"), true);
  assert.equal(body.includes("\n") && !body.replaceAll("\r\n", "").includes("\n"), true);
  assert.match(body, /BEGIN:VCALENDAR\r\nVERSION:2\.0\r\nPRODID:-\/\/Loser League\/\/Pick Deadlines\/\/EN/);
  assert.match(body, /SUMMARY:Loser League Picks Due/);
  assert.match(body, /DTSTART:20260910T233000Z/);
  assert.match(body, /SEQUENCE:2/);
  assert.match(body, /URL:https:\/\/example\.invalid\/dashboard\.html/);
  assert.match(body, /BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:-PT24H/);
  for (const privateWord of ["User", "Track", "Pick:", "Team", "standing", "payment", "buyback"]) assert.equal(body.includes(privateWord), false);
});

test("stable UID survives deadline changes and cancellation is explicit", () => {
  const identity = { year: 2026, phase: "PLAYOFF", round: 19 };
  assert.equal(stableEventUid(identity), stableEventUid({ ...identity, deadline: new Date() }));
  const body = serializeCalendar({
    events: [{ uid: stableEventUid(identity), deadline: new Date("2027-01-10T18:00:00Z"), sequence: 3, revisedAt: new Date("2027-01-01T00:00:00Z"), status: "CANCELLED" }],
    dashboardUrl: "https://example.invalid/dashboard.html",
  });
  assert.match(body, /STATUS:CANCELLED/);
});

test("text escaping and UTF-8 line folding preserve RFC limits", () => {
  const longUrl = `https://example.invalid/dashboard.html?label=${"🎃,;\\line".repeat(10)}`;
  const body = serializeCalendar({ events: [], dashboardUrl: longUrl });
  assert.equal(Buffer.byteLength(body.split("\r\n").find((line) => line.startsWith("X-WR-CALNAME")) || ""), 0);
  for (const line of body.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75, `overlong line: ${line}`);
});
