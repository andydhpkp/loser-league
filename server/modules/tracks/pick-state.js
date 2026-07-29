function makePick({ availablePicks, usedPicks, currentPick }, nextPick) {
  const nextAvailable = [...availablePicks];
  const nextUsed = [...usedPicks];
  const index = nextAvailable.indexOf(nextPick);

  if (index !== -1) {
    nextAvailable.splice(index, 1);
    nextUsed.push(nextPick);
  }

  return {
    availablePicks: nextAvailable,
    usedPicks: nextUsed,
    currentPick: nextPick,
  };
}

function replaceCurrentPick(
  { availablePicks, usedPicks, currentPick },
  nextPick
) {
  let nextAvailable = [...availablePicks];
  let nextUsed = [...usedPicks];

  if (currentPick) {
    nextAvailable.push(currentPick);
    nextUsed = nextUsed.filter((pick) => pick !== currentPick);
  }

  nextAvailable = nextAvailable.filter((pick) => pick !== nextPick);
  nextUsed.push(nextPick);

  return {
    availablePicks: nextAvailable,
    usedPicks: nextUsed,
    currentPick: nextPick,
  };
}

module.exports = { makePick, replaceCurrentPick };
