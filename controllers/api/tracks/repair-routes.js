const router = require("express").Router();
const { Track, User } = require("../../../models/my-index");
const { Op, Sequelize } = require("sequelize");
const { logger } = require("../../../server/lib/logger");

router.put("/fix-wrong-pick/:minLength", async (req, res) => {
  const minLength = parseInt(req.params.minLength);

  if (isNaN(minLength) || minLength < 1) {
    return res.status(400).json({
      error: "A valid minimum length (1 or greater) is required",
    });
  }

  try {
    // Fetch all tracks
    const tracks = await Track.findAll({
      include: [
        {
          model: User,
          attributes: ["id", "first_name", "last_name", "username", "email"],
        },
      ],
    });

    if (!tracks || tracks.length === 0) {
      return res.status(404).json({ message: "No tracks found" });
    }

    const updatedTracks = [];
    const skippedTracks = [];
    const trackUpdates = [];

    // Process each track
    for (const track of tracks) {
      let usedPicks = [...track.used_picks]; // Create a copy
      let wrongPick = track.wrong_pick;

      // Only process tracks where used_picks length is lower than minLength
      if (usedPicks.length < minLength) {
        // Check if there are any used picks to move
        if (usedPicks.length > 0) {
          // Get the last element from used_picks
          const lastUsedPick = usedPicks[usedPicks.length - 1];

          // Set wrong_pick to the last used pick
          wrongPick = lastUsedPick;

          // Update the track
          trackUpdates.push(track.update({ wrong_pick: wrongPick }));

          updatedTracks.push({
            trackId: track.id,
            userId: track.user_id,
            username: track.User ? track.User.username : "Unknown",
            usedPicksLength: usedPicks.length,
            newWrongPick: wrongPick,
            previousWrongPick: track.wrong_pick,
          });
        } else {
          // No used picks available to move
          skippedTracks.push({
            trackId: track.id,
            userId: track.user_id,
            username: track.User ? track.User.username : "Unknown",
            usedPicksLength: usedPicks.length,
            reason: "No used picks available to move to wrong_pick",
          });
        }
      } else {
        // Track already meets or exceeds the minimum length
        skippedTracks.push({
          trackId: track.id,
          userId: track.user_id,
          username: track.User ? track.User.username : "Unknown",
          usedPicksLength: usedPicks.length,
          reason: `Used picks length (${usedPicks.length}) >= minimum length (${minLength})`,
        });
      }
    }

    // Wait for all updates to complete
    await Promise.all(trackUpdates);

    res.json({
      message: `Successfully updated wrong_pick for ${updatedTracks.length} tracks with used_picks length < ${minLength}`,
      minLength: minLength,
      totalTracksProcessed: tracks.length,
      tracksUpdated: updatedTracks.length,
      tracksSkipped: skippedTracks.length,
      updatedTracks: updatedTracks,
      skippedTracks: skippedTracks,
    });
  } catch (error) {
    logger.error("wrong_pick_repair_failed", { errorType: error.name });
    res.status(500).json({
      error: "An error occurred while fixing wrong_pick",
      errorMessage: error.message,
    });
  }
});

// Route to set wrong_pick if the last used pick matches teams passed in the body
router.put("/bug-fix/set-wrong-pick-for-teams", async (req, res) => {
  const { teams } = req.body;

  // Validate that teams array is provided
  if (!teams || !Array.isArray(teams) || teams.length === 0) {
    return res.status(400).json({
      error: "A valid teams array is required in the request body",
    });
  }

  try {
    // Fetch all tracks
    const tracks = await Track.findAll({
      include: [
        {
          model: User,
          attributes: ["id", "first_name", "last_name", "username", "email"],
        },
      ],
    });

    if (!tracks || tracks.length === 0) {
      return res.status(404).json({ message: "No tracks found" });
    }

    const updatedTracks = [];
    const skippedTracks = [];
    const trackUpdates = [];

    // Process each track
    for (const track of tracks) {
      let usedPicks = [...track.used_picks]; // Create a copy

      // Check if there are any used picks
      if (usedPicks.length > 0) {
        // Get the last element from used_picks
        const lastUsedPick = usedPicks[usedPicks.length - 1];

        // Check if the last used pick is in the teams list
        if (teams.includes(lastUsedPick)) {
          // Update wrong_pick to the last used pick
          trackUpdates.push(track.update({ wrong_pick: lastUsedPick }));

          updatedTracks.push({
            trackId: track.id,
            userId: track.user_id,
            username: track.User ? track.User.username : "Unknown",
            usedPicksLength: usedPicks.length,
            lastUsedPick: lastUsedPick,
            newWrongPick: lastUsedPick,
            previousWrongPick: track.wrong_pick,
          });
        } else {
          // Last pick is not in the teams list
          skippedTracks.push({
            trackId: track.id,
            userId: track.user_id,
            username: track.User ? track.User.username : "Unknown",
            usedPicksLength: usedPicks.length,
            lastUsedPick: lastUsedPick,
            reason: `Last used pick "${lastUsedPick}" is not in the provided teams list`,
          });
        }
      } else {
        // No used picks available
        skippedTracks.push({
          trackId: track.id,
          userId: track.user_id,
          username: track.User ? track.User.username : "Unknown",
          usedPicksLength: 0,
          reason: "No used picks available",
        });
      }
    }

    // Wait for all updates to complete
    await Promise.all(trackUpdates);

    res.json({
      message: `Successfully updated wrong_pick for ${updatedTracks.length} tracks`,
      totalTracksProcessed: tracks.length,
      tracksUpdated: updatedTracks.length,
      tracksSkipped: skippedTracks.length,
      teamsProvided: teams,
      updatedTracks: updatedTracks,
      skippedTracks: skippedTracks,
    });
  } catch (error) {
    logger.error("wrong_pick_assignment_failed", { errorType: error.name });
    res.status(500).json({
      error: "An error occurred while setting wrong_pick for teams",
      errorMessage: error.message,
    });
  }
});

// Route to clear wrong_pick if it matches current_pick for tracks with specific used_picks length
router.put("/bug-fix/clear-wrong-pick-if-matches/:length", async (req, res) => {
  const targetLength = parseInt(req.params.length);

  if (isNaN(targetLength) || targetLength < 0) {
    return res.status(400).json({
      error: "A valid length (0 or greater) is required",
    });
  }

  try {
    // Fetch all tracks with the specified used_picks length
    const tracks = await Track.findAll({
      include: [
        {
          model: User,
          attributes: ["id", "first_name", "last_name", "username", "email"],
        },
      ],
    });

    if (!tracks || tracks.length === 0) {
      return res.status(404).json({ message: "No tracks found" });
    }

    const updatedTracks = [];
    const skippedTracks = [];
    const trackUpdates = [];

    // Process each track
    for (const track of tracks) {
      let usedPicks = [...track.used_picks]; // Create a copy

      // Only process tracks with the target used_picks length
      if (usedPicks.length === targetLength) {
        // Check if wrong_pick matches current_pick
        if (track.wrong_pick && track.current_pick && track.wrong_pick === track.current_pick) {
          // Clear wrong_pick
          trackUpdates.push(track.update({ wrong_pick: null }));

          updatedTracks.push({
            trackId: track.id,
            userId: track.user_id,
            username: track.User ? track.User.username : "Unknown",
            usedPicksLength: usedPicks.length,
            previousWrongPick: track.wrong_pick,
            currentPick: track.current_pick,
            action: "Cleared wrong_pick because it matched current_pick",
          });
        } else {
          // wrong_pick doesn't match current_pick, skip
          skippedTracks.push({
            trackId: track.id,
            userId: track.user_id,
            username: track.User ? track.User.username : "Unknown",
            usedPicksLength: usedPicks.length,
            wrongPick: track.wrong_pick,
            currentPick: track.current_pick,
            reason: "wrong_pick doesn't match current_pick or one of them is null",
          });
        }
      } else {
        // Track doesn't have the target length, skip
        skippedTracks.push({
          trackId: track.id,
          userId: track.user_id,
          username: track.User ? track.User.username : "Unknown",
          usedPicksLength: usedPicks.length,
          reason: `Used picks length (${usedPicks.length}) doesn't match target length (${targetLength})`,
        });
      }
    }

    // Wait for all updates to complete
    await Promise.all(trackUpdates);

    res.json({
      message: `Successfully cleared wrong_pick for ${updatedTracks.length} tracks with used_picks length = ${targetLength}`,
      targetLength: targetLength,
      totalTracksProcessed: tracks.length,
      tracksUpdated: updatedTracks.length,
      tracksSkipped: skippedTracks.length,
      updatedTracks: updatedTracks,
      skippedTracks: skippedTracks,
    });
  } catch (error) {
    logger.error("wrong_pick_cleanup_failed", { errorType: error.name });
    res.status(500).json({
      error: "An error occurred while clearing wrong_pick",
      errorMessage: error.message,
    });
  }
});

module.exports = router;
