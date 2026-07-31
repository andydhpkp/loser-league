export function fetchNflTeams(fetchImpl = globalThis.fetch) {
  return fetchImpl("/api/nfl/teams");
}

export function fetchNflSchedule(year, week, fetchImpl = globalThis.fetch) {
  const query = new globalThis.URLSearchParams({
    year: String(year),
    week: String(week),
  });
  return fetchImpl(`/api/nfl/schedule?${query}`);
}

export function getLeagueSeasonYear(games) {
  const date = games?.[0]?.DateUtc;
  const match = typeof date === "string" ? /^(\d{4})-/.exec(date) : null;
  return match ? Number(match[1]) : null;
}
