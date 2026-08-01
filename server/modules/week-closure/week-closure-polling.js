const EXPECTED_GAME_DURATION_MS = 165 * 60 * 1000;
const ACTIVE_POLL_MS = 60 * 1000;
const DELAYED_POLL_MS = 5 * 60 * 1000;

function planNextResultCheck({ now, kickoffs, games }) {
  const currentTime = now.getTime();
  const pendingExpectedFinishes = kickoffs
    .map((kickoff, index) => ({
      expectedFinish: new Date(kickoff).getTime() + EXPECTED_GAME_DURATION_MS,
      game: games[index],
    }))
    .filter(({ game }) => game?.status !== "FINAL")
    .sort((left, right) => left.expectedFinish - right.expectedFinish);
  if (!pendingExpectedFinishes.length) return { checkAt: null, refreshSchedule: false };
  if (pendingExpectedFinishes.some(({ game }) => game?.status === "DELAYED")) {
    return { checkAt: new Date(currentTime + DELAYED_POLL_MS), refreshSchedule: true };
  }
  if (pendingExpectedFinishes.some(({ expectedFinish }) => expectedFinish <= currentTime)) {
    return { checkAt: new Date(currentTime + ACTIVE_POLL_MS), refreshSchedule: false };
  }
  return { checkAt: new Date(pendingExpectedFinishes[0].expectedFinish), refreshSchedule: false };
}

module.exports = { planNextResultCheck };
