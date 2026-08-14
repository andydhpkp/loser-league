const crypto = require("node:crypto");

const PHASES = new Set(["PRESEASON", "REGULAR", "PLAYOFF"]);

function validateRound({ year, phase, round, games }) {
  if (!Number.isInteger(year) || year < 1000 || year > 9999 || !PHASES.has(phase) || !Number.isInteger(round) || round < 1 || round > 22 || !Array.isArray(games) || !games.length) throw new TypeError("Calendar round is invalid");
  const matchups = new Map();
  const teams = new Set();
  const normalized = [];
  for (const game of games) {
    const homeTeam = String(game.homeTeam || "").trim();
    const awayTeam = String(game.awayTeam || "").trim();
    const kickoff = new Date(game.kickoff);
    if (!homeTeam || !awayTeam || homeTeam === awayTeam || Number.isNaN(kickoff.getTime())) throw new TypeError("Calendar round is invalid");
    const kickoffYear = kickoff.getUTCFullYear();
    if ((phase !== "PLAYOFF" && kickoffYear !== year) || (phase === "PLAYOFF" && ![year, year + 1].includes(kickoffYear))) throw new TypeError("Calendar round is invalid");
    const matchup = [homeTeam, awayTeam].sort().join("|");
    const timestamp = kickoff.toISOString();
    if (matchups.has(matchup) && matchups.get(matchup) !== timestamp) throw new TypeError("Calendar round is invalid");
    if (matchups.has(matchup)) continue;
    if (teams.has(homeTeam) || teams.has(awayTeam)) throw new TypeError("Calendar round is invalid");
    teams.add(homeTeam); teams.add(awayTeam); matchups.set(matchup, timestamp);
    normalized.push({ kickoff: timestamp, homeTeam, awayTeam });
  }
  normalized.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const earliest = normalized[0].kickoff;
  const sourceHash = crypto.createHash("sha256").update(JSON.stringify({ year, phase, round, games: normalized })).digest("hex");
  return { year, phase, round, deadline: new Date(earliest), sourceHash };
}

function validateSeasonRounds({ year, phase, rounds }) {
  const valid = [];
  const invalidRounds = [];
  for (const candidate of Array.isArray(rounds) ? rounds : []) {
    const round = Number(candidate.round);
    if (round === 0) continue;
    try { valid.push(validateRound({ year, phase, round, games: candidate.games })); }
    catch { if (Number.isInteger(round) && round >= 1 && round <= 22) invalidRounds.push(round); }
  }
  return { valid: valid.sort((a, b) => a.round - b.round), invalidRounds: [...new Set(invalidRounds)].sort((a, b) => a - b) };
}

module.exports = { validateRound, validateSeasonRounds };
