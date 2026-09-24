const assert = require("node:assert/strict");
const test = require("node:test");

const {
  eligibleTeamsForTrack,
  currentPickVisibility,
  leagueViewAccess,
} = require("../../server/modules/picks/submission-policy");
const {
  fetchFixtureSchedule,
  fetchPreseasonWeeks,
  normalizeEspnFixtureSchedule,
  normalizeFixtureSchedule,
  restoreFixtureSchedule,
} = require("../../server/nfl/fixture-download-client");
const { autoPickDue } = require("../../server/modules/picks/auto-pick-policy");

test("saved schedule retains evidence and recalculates deadline and eligibility at submission time", () => {
  const snapshot = { week: 1, provider: "FIXTURE_DOWNLOAD", content_hash: "a".repeat(64), fetched_at: new Date("2026-09-01T00:00:00Z"), normalized_schedule: { week: 1, games: [
    { kickoff: "2026-09-10T00:00:00Z", homeTeam: "Broncos", awayTeam: "Raiders" },
    { kickoff: "2026-09-11T00:00:00Z", homeTeam: "Chiefs", awayTeam: "Chargers" },
  ] } };
  const input = { year: 2026, week: 1, now: new Date("2026-09-10T12:00:00Z") };
  const regular = restoreFixtureSchedule(snapshot, input);
  assert.equal(regular.earliestKickoff.toISOString(), "2026-09-10T00:00:00.000Z");
  assert.equal(regular.contentHash, snapshot.content_hash);
  assert.equal(regular.normalizedSchedule, snapshot.normalized_schedule);
  assert.equal(regular.fetchedAt, snapshot.fetched_at);
  assert.deepEqual(regular.teams, ["Broncos", "Chargers", "Chiefs", "Raiders"]);
  const late = restoreFixtureSchedule(snapshot, { ...input, allowStartedGames: true });
  assert.equal(late.earliestKickoff.toISOString(), "2026-09-11T00:00:00.000Z");
  assert.deepEqual(late.teams, ["Chargers", "Chiefs"]);
  const preseason = restoreFixtureSchedule({ ...snapshot, provider: "ESPN" }, { ...input, seasonPhase: "PRESEASON", allowStartedGames: true });
  assert.equal(preseason.earliestKickoff.toISOString(), "2026-09-10T00:00:00.000Z");
  assert.deepEqual(preseason.teams, ["Chargers", "Chiefs"]);
});

test("saved schedule rejects malformed games and mismatched schedule evidence", () => {
  const snapshot = { week: 1, provider: "FIXTURE_DOWNLOAD", content_hash: "a".repeat(64), normalized_schedule: { week: 1, games: [{ kickoff: "2026-09-10T00:00:00Z", homeTeam: "Broncos", awayTeam: "Raiders" }] } };
  const input = { year: 2026, week: 1 };
  for (const invalid of [
    { ...snapshot, provider: "ESPN" },
    { ...snapshot, week: 2 },
    { ...snapshot, content_hash: "invalid" },
    { ...snapshot, normalized_schedule: null },
    { ...snapshot, normalized_schedule: { week: 2, games: snapshot.normalized_schedule.games } },
    { ...snapshot, normalized_schedule: { week: 1, games: [] } },
    { ...snapshot, normalized_schedule: { week: 1, games: [null] } },
    { ...snapshot, normalized_schedule: { week: 1, games: [{ ...snapshot.normalized_schedule.games[0], kickoff: "invalid" }] } },
  ]) assert.throws(() => restoreFixtureSchedule(invalid, input), /NFL schedule data is invalid/);
});

test("League view access requires every active Track Pick after Week 0", () => {
  assert.equal(leagueViewAccess({ week: 4, activeTrackIds: [1, 2], pickedTrackIds: [1] }), "BLOCKED");
  assert.equal(leagueViewAccess({ week: 4, activeTrackIds: [1, 2], pickedTrackIds: [1, 2] }), "ALLOWED");
  assert.equal(leagueViewAccess({ week: 4, activeTrackIds: [], pickedTrackIds: [] }), "ALLOWED");
  assert.equal(leagueViewAccess({ week: 0, activeTrackIds: [1, 2], pickedTrackIds: [] }), "ALLOWED");
});

test("eligible Teams are scheduled this week and unused by the Track", () => {
  assert.deepEqual(
    eligibleTeamsForTrack({
      scheduledTeams: ["Broncos", "Raiders", "Chiefs"],
      priorTeamNames: ["Raiders"],
    }),
    ["Broncos", "Chiefs"]
  );
});

test("Fixture Download normalization supplies weekly Teams and earliest kickoff", () => {
  const result = normalizeFixtureSchedule([
    { RoundNumber: 1, DateUtc: "2026-09-11 00:00:00Z", HomeTeam: "Raiders", AwayTeam: "Broncos" },
    { RoundNumber: 1, DateUtc: "2026-09-10 20:00:00Z", HomeTeam: "Chiefs", AwayTeam: "Chargers" },
    { RoundNumber: 2, DateUtc: "2026-09-17 20:00:00Z", HomeTeam: "Jets", AwayTeam: "Bills" },
  ], 1);
  assert.deepEqual(result.teams, ["Broncos", "Chargers", "Chiefs", "Raiders"]);
  assert.equal(result.earliestKickoff.toISOString(), "2026-09-10T20:00:00.000Z");
  assert.match(result.contentHash, /^[a-f0-9]{64}$/);
});

test("preseason normalization disables started games but keeps the first kickoff as the deadline", () => {
  const result = normalizeEspnFixtureSchedule({ events: [
    { date: "2026-08-01T00:00:00Z", status: { type: { completed: true } }, competitions: [{ competitors: [{ homeAway: "home", team: { displayName: "Broncos" } }, { homeAway: "away", team: { displayName: "Raiders" } }] }] },
    { date: "2026-08-03T00:00:00Z", status: { type: { completed: false } }, competitions: [{ competitors: [{ homeAway: "home", team: { displayName: "Chiefs" } }, { homeAway: "away", team: { displayName: "Chargers" } }] }] },
  ] }, 1, new Date("2026-08-02T00:00:00Z"));
  assert.deepEqual(result.teams, ["Chargers", "Chiefs"]);
  assert.equal(result.earliestKickoff.toISOString(), "2026-08-01T00:00:00.000Z");
  assert.equal(autoPickDue({ now: new Date("2026-08-02T00:00:00Z"), deadline: result.earliestKickoff }), true);
  assert.equal(result.completed, false);
  assert.equal(result.normalizedSchedule.games.length, 2);
});

test("Fixture Download client returns normalized schedule metadata", async () => {
  const fetchedAt = new Date("2026-09-01T12:00:00.000Z");
  let requestedUrl;

  const result = await fetchFixtureSchedule({
    year: 2026,
    week: 1,
    now: fetchedAt,
    fetchImpl: async (url) => {
      requestedUrl = url;
      return {
        ok: true,
        json: async () => [{
          RoundNumber: 1,
          DateUtc: "2026-09-10 20:00:00Z",
          HomeTeam: "Denver Broncos",
          AwayTeam: "Las Vegas Raiders",
        }],
      };
    },
  });

  assert.equal(requestedUrl, "https://fixturedownload.com/feed/json/nfl-2026");
  assert.equal(result.year, 2026);
  assert.equal(result.week, 1);
  assert.equal(result.provider, "FIXTURE_DOWNLOAD");
  assert.equal(result.fetchedAt, fetchedAt);
  assert.deepEqual(result.teams, ["Denver Broncos", "Las Vegas Raiders"]);
});

test("preseason client reads ESPN schedule metadata and tolerates an absent Week 4", async () => {
  const event = (week) => ({ date: `2026-08-0${week}T00:00:00Z`, status: { type: { completed: week < 2 } }, competitions: [{ competitors: [{ homeAway: "home", team: { displayName: "Broncos" } }, { homeAway: "away", team: { displayName: "Raiders" } }] }] });
  const fetchImpl = async (url) => {
    const week = Number(new URL(url).searchParams.get("week"));
    return week === 4 ? { ok: false } : { ok: true, async json() { return { events: [event(week)] }; } };
  };
  const schedule = await fetchFixtureSchedule({ year: 2026, week: 2, seasonPhase: "PRESEASON", fetchImpl, now: new Date("2026-08-01T00:00:00Z") });
  assert.equal(schedule.provider, "ESPN");
  assert.equal(schedule.week, 2);
  const weeks = await fetchPreseasonWeeks({ year: 2026, fetchImpl, now: new Date("2026-08-01T00:00:00Z") });
  assert.deepEqual(weeks.map((item) => item.week), [1, 2, 3]);
});

test("Fixture Download client maps transport failure to a safe upstream error", async () => {
  const transportError = new Error("private transport detail");

  await assert.rejects(
    fetchFixtureSchedule({
      year: 2026,
      week: 1,
      fetchImpl: async () => {
        throw transportError;
      },
    }),
    (error) => {
      assert.equal(error.code, "UPSTREAM_ERROR");
      assert.equal(error.status, 502);
      assert.equal(error.message, "NFL schedule data is unavailable");
      assert.equal(error.cause, transportError);
      return true;
    }
  );
});

test("current Pick visibility is hidden until every active Track has a Pick", () => {
  assert.equal(
    currentPickVisibility({ activeTrackIds: [1, 2], pickedTrackIds: [1] }),
    "HIDDEN"
  );
  assert.equal(
    currentPickVisibility({ activeTrackIds: [1, 2], pickedTrackIds: [1, 2] }),
    "VISIBLE"
  );
  assert.equal(
    currentPickVisibility({ activeTrackIds: [], pickedTrackIds: [] }),
    "VISIBLE"
  );
});
