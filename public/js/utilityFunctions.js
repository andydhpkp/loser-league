function getCrownInfo(userRecord) {
  // If no user_record, no crown
  if (!userRecord || userRecord.length === 0) {
    return null;
  }

  // Calculate win statistics
  const totalWins = userRecord.filter((record) => record.won).length;
  const cleanWins = userRecord.filter(
    (record) => record.won && !record.won_with_tie
  ).length;
  const tieWins = userRecord.filter(
    (record) => record.won && record.won_with_tie
  ).length;

  // Crown logic - easily expandable for future types
  if (totalWins === 0) {
    return null; // No wins, no crown
  }

  // Current logic: if user has any tie wins, show silver crown
  if (tieWins > 0) {
    return {
      src: "/css/assets/crowns/silver-crown-1.png",
      alt: "Silver Crown - Won with tie",
      title: `${totalWins} win${
        totalWins > 1 ? "s" : ""
      } (including ${tieWins} tie${tieWins > 1 ? "s" : ""})`,
    };
  }

  // Future expandability examples (commented out for now):
  /*
  // Multiple clean wins could get gold crown
  if (cleanWins >= 3) {
    return {
      src: "/css/assets/crowns/gold-crown.png",
      alt: "Gold Crown - Multiple clean wins",
      title: `${cleanWins} clean wins`
    };
  }
  
  // Single clean win could get bronze crown
  if (cleanWins === 1) {
    return {
      src: "/css/assets/crowns/bronze-crown.png", 
      alt: "Bronze Crown - Single clean win",
      title: "1 clean win"
    };
  }
  */

  // For now, any other wins (clean wins) get no crown since we only have silver
  // In the future, this would be where you'd add other crown types
  return null;
}

function sortUsersByTracksLeft(users) {
  return users.sort((a, b) => {
    // Calculate tracks left for user A
    const aTracksLeft = a.tracks.filter(
      (track) => track.wrong_pick === null
    ).length;

    // Calculate tracks left for user B
    const bTracksLeft = b.tracks.filter(
      (track) => track.wrong_pick === null
    ).length;

    // Sort by tracks left (descending - most tracks first)
    // If tracks are equal, sort alphabetically by first name as tiebreaker
    if (bTracksLeft === aTracksLeft) {
      return a.first_name.localeCompare(b.first_name);
    }

    return bTracksLeft - aTracksLeft;
  });
}

// weeklyStats.js

// js/weeklyStats.js

function computeWeekStats(users) {
  const currentPicks = [];
  const onTheBlock = [];
  const stillPerfect = [];
  const userTrackCounts = [];

  users.forEach((user) => {
    const aliveTracks = user.tracks.filter((t) => t.wrong_pick === null);

    // Store user info with their alive track count
    userTrackCounts.push({
      name: `${user.first_name} ${user.last_name}`,
      aliveTracksCount: aliveTracks.length,
    });

    if (aliveTracks.length === 1) {
      onTheBlock.push(`${user.first_name} ${user.last_name}`);
    }

    // "Still Perfect": user has NOT lost a valid track (i.e., all tracks are still alive)
    if (
      user.tracks.length > 0 &&
      user.tracks.every((t) => t.wrong_pick === null)
    ) {
      stillPerfect.push(`${user.first_name} ${user.last_name}`);
    }

    // Count only current valid picks toward popularity
    aliveTracks.forEach((t) => {
      if (t.current_pick) currentPicks.push(t.current_pick);
    });
  });

  // Count occurrences of each pick
  const pickCount = {};
  currentPicks.forEach(
    (pick) => (pickCount[pick] = (pickCount[pick] || 0) + 1)
  );

  let mostPopular = "—";
  let leastPopular = "—";

  const keys = Object.keys(pickCount);
  if (keys.length > 0) {
    const counts = Object.values(pickCount);
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);

    const most = keys.filter((k) => pickCount[k] === maxCount);
    const least = keys.filter((k) => pickCount[k] === minCount);

    mostPopular = `${most.join(", ")} (${maxCount})`;
    leastPopular = `${least.join(", ")} (${minCount})`;
  }

  // Find users with the most tracks
  let mostTracks = "—";
  if (userTrackCounts.length > 0) {
    const maxTracksCount = Math.max(
      ...userTrackCounts.map((u) => u.aliveTracksCount)
    );
    const usersWithMostTracks = userTrackCounts
      .filter((u) => u.aliveTracksCount === maxTracksCount)
      .map((u) => u.name);

    mostTracks = `${usersWithMostTracks.join(", ")} (${maxTracksCount})`;
  }

  return {
    mostPopular,
    leastPopular,
    onTheBlock: onTheBlock.length ? onTheBlock.join(", ") : "None",
    stillPerfect: stillPerfect.length ? stillPerfect.join(", ") : "None",
    mostTracks: mostTracks,
  };
}

async function populateWeekStatsModal() {
  try {
    const res = await fetch("/api/users");
    if (!res.ok) throw new Error("Failed to load users");

    const users = await res.json();
    const stats = computeWeekStats(users);

    // Inject into the existing modal DOM
    document.getElementById("stat-most-popular").innerText = stats.mostPopular;
    document.getElementById("stat-least-popular").innerText =
      stats.leastPopular;
    document.getElementById("stat-on-the-block").innerText = stats.onTheBlock;
    document.getElementById("stat-still-perfect").innerText =
      stats.stillPerfect;
    document.getElementById("stat-most-tracks").innerText = stats.mostTracks;
  } catch (err) {
    console.error("Weekly stats error:", err);
  }
}

// Wire up: refresh stats each time the modal opens
document.addEventListener("DOMContentLoaded", () => {
  const modalEl = document.getElementById("weekStatsModal");
  if (!modalEl) return;

  modalEl.addEventListener("show.bs.modal", () => {
    populateWeekStatsModal();
  });
});
