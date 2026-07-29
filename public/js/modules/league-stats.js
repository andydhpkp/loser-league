export function sortUsersByTracksLeft(users) {
  return users.sort((a, b) => {
    const aTracksLeft = a.tracks.filter(
      (track) => track.wrong_pick === null
    ).length;
    const bTracksLeft = b.tracks.filter(
      (track) => track.wrong_pick === null
    ).length;

    if (bTracksLeft === aTracksLeft) {
      return a.first_name.localeCompare(b.first_name);
    }

    return bTracksLeft - aTracksLeft;
  });
}

export function computeWeekStats(users) {
  const currentPicks = [];
  const onTheBlock = [];
  const stillPerfect = [];
  const userTrackCounts = [];

  users.forEach((user) => {
    const aliveTracks = user.tracks.filter((track) => track.wrong_pick === null);

    userTrackCounts.push({
      name: `${user.first_name} ${user.last_name}`,
      aliveTracksCount: aliveTracks.length,
    });

    if (aliveTracks.length === 1) {
      onTheBlock.push(`${user.first_name} ${user.last_name}`);
    }

    if (
      user.tracks.length > 0 &&
      user.tracks.every((track) => track.wrong_pick === null)
    ) {
      stillPerfect.push(`${user.first_name} ${user.last_name}`);
    }

    aliveTracks.forEach((track) => {
      if (track.current_pick) {
        currentPicks.push(track.current_pick);
      }
    });
  });

  const pickCount = {};
  currentPicks.forEach((pick) => {
    pickCount[pick] = (pickCount[pick] || 0) + 1;
  });

  let mostPopular = "—";
  let leastPopular = "—";
  const keys = Object.keys(pickCount);

  if (keys.length > 0) {
    const counts = Object.values(pickCount);
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);
    const most = keys.filter((key) => pickCount[key] === maxCount);
    const least = keys.filter((key) => pickCount[key] === minCount);

    mostPopular = `${most.join(", ")} (${maxCount})`;
    leastPopular = `${least.join(", ")} (${minCount})`;
  }

  let mostTracks = "—";
  if (userTrackCounts.length > 0) {
    const maxTracksCount = Math.max(
      ...userTrackCounts.map((user) => user.aliveTracksCount)
    );
    const usersWithMostTracks = userTrackCounts
      .filter((user) => user.aliveTracksCount === maxTracksCount)
      .map((user) => user.name);

    mostTracks = `${usersWithMostTracks.join(", ")} (${maxTracksCount})`;
  }

  return {
    mostPopular,
    leastPopular,
    onTheBlock: onTheBlock.length ? onTheBlock.join(", ") : "None",
    stillPerfect: stillPerfect.length ? stillPerfect.join(", ") : "None",
    mostTracks,
  };
}
