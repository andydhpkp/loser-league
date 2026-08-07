export function fetchNflTeams(fetchImpl = globalThis.fetch) {
  return fetchImpl("/api/nfl/teams");
}

export function fetchNflSchedule(year, week, fetchImpl = globalThis.fetch, seasonType = "regular") {
  const query = new globalThis.URLSearchParams({
    year: String(year),
    week: String(week),
  });
  if (seasonType === "preseason") query.set("seasonType", "preseason");
  return fetchImpl(`/api/nfl/schedule?${query}`);
}

export function getLeagueSeasonYear(games) {
  const date = games?.[0]?.DateUtc;
  const match = typeof date === "string" ? /^(\d{4})-/.exec(date) : null;
  return match ? Number(match[1]) : null;
}

export function filterFixtureWeek(games, week) {
  if (!Number.isInteger(week) || week < 1 || week > 22) {
    throw new Error("A valid League Season week is required");
  }
  return games.filter((game) => Number(game.RoundNumber) === week);
}
