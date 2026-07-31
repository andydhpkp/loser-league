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
