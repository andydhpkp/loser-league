const test = require("node:test");
const assert = require("node:assert/strict");
const { createCalendarScheduleLoader } = require("../../server/modules/calendar/calendar-schedule-loader");

test("calendar season loader partitions one Fixture response into regular and playoff rounds", async () => {
  let calls = 0;
  const loader = createCalendarScheduleLoader({ findSeason: async () => ({ id: 1, year: 2026, state: "ACTIVE", current_week: 1, schedule_phase: "REGULAR" }), fetchImpl: async () => { calls += 1; return { ok: true, json: async () => [
    { RoundNumber: 1, DateUtc: "2026-09-10T23:30:00Z", HomeTeam: "Broncos", AwayTeam: "Raiders" },
    { RoundNumber: 19, DateUtc: "2027-01-10T18:00:00Z", HomeTeam: "Chiefs", AwayTeam: "Chargers" },
  ] }; } });
  const result = await loader(); assert.equal(calls, 1); assert.deepEqual(result.evidence.map(({ phase, round }) => [phase, round]), [["REGULAR", 1], ["PLAYOFF", 19]]); assert.deepEqual(result.invalidKeys, []);
});

test("calendar season loader is empty in setup and isolates a malformed Fixture round", async () => {
  const setup = createCalendarScheduleLoader({ findSeason: async () => ({ state: "SETUP", current_week: 0 }), fetchImpl: async () => { throw new Error("must not fetch"); } });
  assert.deepEqual((await setup()).evidence, []);
  const loader = createCalendarScheduleLoader({ findSeason: async () => ({ id: 1, year: 2026, state: "ACTIVE", current_week: 1, schedule_phase: "REGULAR" }), fetchImpl: async () => ({ ok: true, json: async () => [
    { RoundNumber: 1, DateUtc: "bad", HomeTeam: "A", AwayTeam: "B" },
    { RoundNumber: 2, DateUtc: "2026-09-17T00:00:00Z", HomeTeam: "C", AwayTeam: "D" },
  ] }) });
  const result = await loader(); assert.deepEqual(result.invalidKeys, ["2026:REGULAR:1"]); assert.deepEqual(result.evidence.map(({ round }) => round), [2]);
});

test("preseason loader validates ESPN rounds independently but treats transport failure as fallback", async () => {
  let call = 0;
  const season = { id: 1, year: 2026, state: "ACTIVE", current_week: 1, schedule_phase: "PRESEASON" };
  const loader = createCalendarScheduleLoader({
    findSeason: async () => season,
    fetchImpl: async () => {
      call += 1;
      const events = call === 2
        ? [{ date: "bad", competitions: [{ competitors: [] }] }]
        : [{ date: `2026-08-${String(call + 7).padStart(2, "0")}T00:00:00Z`, competitions: [{ competitors: [{ homeAway: "home", team: { displayName: `Home ${call}` } }, { homeAway: "away", team: { displayName: `Away ${call}` } }] }] }];
      return { ok: true, json: async () => ({ events }) };
    },
  });
  const result = await loader(); assert.deepEqual(result.invalidKeys, ["2026:PRESEASON:2"]); assert.deepEqual(result.evidence.map(({ round }) => round), [1, 3, 4]);
  const failed = createCalendarScheduleLoader({ findSeason: async () => season, fetchImpl: async () => ({ ok: false }) });
  await assert.rejects(failed(), /unavailable/);
});
