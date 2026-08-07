function unfinishedWeek(week) {
  return Number.isInteger(week?.week) && Array.isArray(week.games) && week.games.some((game) => game.completed !== true);
}

function inferPreseasonWeek(weeks) {
  return [...(weeks || [])].sort((a, b) => a.week - b.week).find(unfinishedWeek)?.week ?? null;
}

function nextPreseasonWeek(currentWeek, weeks) {
  return inferPreseasonWeek((weeks || []).filter((week) => week.week > currentWeek));
}

module.exports = { inferPreseasonWeek, nextPreseasonWeek };
