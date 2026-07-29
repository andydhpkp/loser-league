import { browserLogger } from "../logger.js";

async function getAliveTracksByUserId(userId) {
  let response = await fetch(`/api/tracks/user/${userId}/alive`);
  if (response.ok) {
    let tracks = await response.json();
    return tracks;
  } else if (response.status === 404) {
    browserLogger.warn("No tracks available for user.");
    return "No tracks alive";
  } else {
    browserLogger.error(
      "Failed to fetch alive tracks for user",
      await response.text()
    );
    return [];
  }
}

export function pushToLeaguePage() {
  let userId = localStorage.getItem("loggedInUserId");
  let currentWeek = parseInt(localStorage.getItem("thisWeek"), 10);

  getAliveTracksByUserId(userId)
    .then((tracks) => {
      if (tracks.length === 0) {
        browserLogger.debug("No tracks available.");
        return; // Exit the function early without redirecting
      }
      if (tracks === "No tracks alive") {
        window.location.href = "../league-page.html";
      }
      if (tracks.every((track) => track.used_picks.length >= currentWeek)) {
        window.location.href = "../league-page.html";
      } else {
        browserLogger.debug("Not all tracks meet the current week criteria.");
      }
    })
    .catch((error) => {
      browserLogger.error("Error in fetching tracks:", error);
    });
}

async function resetWrongPick(trackId) {
  try {
    if (!trackId) {
      throw new Error("Track ID is required");
    }

    const response = await fetch(`/api/tracks/reset-wrong-pick/${trackId}`, {
      method: "PUT",
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error);
    }

    browserLogger.debug("Wrong pick reset successfully");
  } catch (error) {
    browserLogger.error("Error resetting wrong pick:", error.message);
  }
}

async function getTracksWithNonNullWrongPick(userId) {
  try {
    if (!userId) {
      throw new Error("User ID is required");
    }

    const response = await fetch(
      `/api/tracks/wrong-pick-not-null/${userId}`,
      { method: "GET" }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error);
    }

    const data = await response.json();
    browserLogger.debug("Fetched tracks successfully:", data);
  } catch (error) {
    browserLogger.error("Error fetching tracks:", error.message);
  }
}
