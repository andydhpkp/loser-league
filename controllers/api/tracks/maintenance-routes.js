const router = require("express").Router();
const { Track, User } = require("../../../models/my-index");
const { Op, Sequelize } = require("sequelize");
const { logger } = require("../../../server/lib/logger");

router.put("/reset-to-pick-count/:pickCount", async (req, res) => {
  const pickCount = parseInt(req.params.pickCount);

  if (isNaN(pickCount) || pickCount < 0) {
    return res
      .status(400)
      .json({ error: "A valid pick count (0 or greater) is required" });
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
    const trackUpdates = [];

    // Process each track
    for (const track of tracks) {
      let usedPicks = [...track.used_picks]; // Create a copy
      let availablePicks = [...track.available_picks]; // Create a copy
      let wrongPick = track.wrong_pick;

      const originalUsedPicksLength = usedPicks.length;

      // If the track has more used picks than the target count, remove excess picks
      if (usedPicks.length > pickCount) {
        // Get the picks that need to be removed (from the end)
        const picksToRemove = usedPicks.slice(pickCount);

        // Keep only the first 'pickCount' picks
        usedPicks = usedPicks.slice(0, pickCount);

        // Add the removed picks back to available_picks if they're not already there
        picksToRemove.forEach((pick) => {
          if (pick !== "placeholder" && !availablePicks.includes(pick)) {
            availablePicks.push(pick);
          }
        });

        // Handle wrong_pick logic
        if (wrongPick) {
          // If pickCount is 0, clear wrong_pick
          if (pickCount === 0) {
            wrongPick = null;
          } else {
            // Only keep wrong_pick if it matches the first element in used_picks
            const firstUsedPick = usedPicks[0];
            if (wrongPick !== firstUsedPick) {
              wrongPick = null;
            }
          }
        }

        // Update the track
        const updateData = {
          used_picks: usedPicks,
          available_picks: availablePicks,
          wrong_pick: wrongPick,
          current_pick: null, // Clear current pick as requested
        };

        trackUpdates.push(track.update(updateData));

        updatedTracks.push({
          trackId: track.id,
          userId: track.user_id,
          username: track.User ? track.User.username : "Unknown",
          originalUsedPicksCount: originalUsedPicksLength,
          newUsedPicksCount: usedPicks.length,
          removedPicks: picksToRemove,
          wrongPickCleared: track.wrong_pick !== wrongPick,
          newWrongPick: wrongPick,
        });
      } else {
        // Track already has pickCount or fewer picks, but still check wrong_pick logic
        if (wrongPick && pickCount > 0) {
          const firstUsedPick = usedPicks[0];
          if (wrongPick !== firstUsedPick) {
            wrongPick = null;
            trackUpdates.push(
              track.update({
                wrong_pick: wrongPick,
                current_pick: null,
              })
            );

            updatedTracks.push({
              trackId: track.id,
              userId: track.user_id,
              username: track.User ? track.User.username : "Unknown",
              originalUsedPicksCount: originalUsedPicksLength,
              newUsedPicksCount: usedPicks.length,
              removedPicks: [],
              wrongPickCleared: true,
              newWrongPick: wrongPick,
            });
          } else {
            // Just clear current_pick
            trackUpdates.push(track.update({ current_pick: null }));
          }
        } else if (pickCount === 0 && wrongPick) {
          // Clear wrong_pick if resetting to 0 picks
          trackUpdates.push(
            track.update({
              wrong_pick: null,
              current_pick: null,
            })
          );

          updatedTracks.push({
            trackId: track.id,
            userId: track.user_id,
            username: track.User ? track.User.username : "Unknown",
            originalUsedPicksCount: originalUsedPicksLength,
            newUsedPicksCount: usedPicks.length,
            removedPicks: [],
            wrongPickCleared: true,
            newWrongPick: null,
          });
        } else {
          // Just clear current_pick
          trackUpdates.push(track.update({ current_pick: null }));
        }
      }
    }

    // Wait for all updates to complete
    await Promise.all(trackUpdates);

    res.json({
      message: `Successfully reset ${tracks.length} tracks to ${pickCount} pick(s)`,
      resetToPickCount: pickCount,
      totalTracksProcessed: tracks.length,
      tracksModified: updatedTracks.length,
      modifiedTracks: updatedTracks,
    });
  } catch (error) {
    logger.error("track_reset_failed", { errorType: error.name });
    res.status(500).json({
      error: "An error occurred while resetting tracks",
      errorMessage: error.message,
    });
  }
});

// Route to fix current_pick for tracks with specific used_picks length
router.put("/fix-current-pick/:length", async (req, res) => {
  const targetLength = parseInt(req.params.length);

  if (isNaN(targetLength) || targetLength < 1) {
    return res.status(400).json({
      error: "A valid length (1 or greater) is required",
    });
  }

  try {
    // Find all alive tracks where current_pick is null or empty
    const tracksToFix = await Track.findAll({
      where: {
        wrong_pick: null, // Only alive tracks
        [Op.or]: [{ current_pick: null }, { current_pick: "" }],
      },
      include: [
        {
          model: User,
          attributes: ["id", "first_name", "last_name", "username", "email"],
        },
      ],
    });

    if (!tracksToFix || tracksToFix.length === 0) {
      return res.status(404).json({
        message: "No alive tracks found with null current_pick",
      });
    }

    const updatedTracks = [];
    const skippedTracks = [];
    const trackUpdates = [];

    // Process each track
    for (const track of tracksToFix) {
      const usedPicks = track.used_picks || [];

      // Check if the used_picks length matches our target length
      if (usedPicks.length === targetLength) {
        // Get the last pick from used_picks
        const lastPick = usedPicks[usedPicks.length - 1];

        // Update current_pick to the last used pick
        trackUpdates.push(track.update({ current_pick: lastPick }));

        updatedTracks.push({
          trackId: track.id,
          userId: track.user_id,
          username: track.User ? track.User.username : "Unknown",
          usedPicksLength: usedPicks.length,
          newCurrentPick: lastPick,
          usedPicks: usedPicks,
        });
      } else {
        // Track doesn't match our target length, so we skip it
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
      message: `Successfully fixed current_pick for ${updatedTracks.length} alive tracks with ${targetLength} used picks`,
      targetLength: targetLength,
      totalTracksChecked: tracksToFix.length,
      tracksUpdated: updatedTracks.length,
      tracksSkipped: skippedTracks.length,
      updatedTracks: updatedTracks,
      skippedTracks: skippedTracks,
    });
  } catch (error) {
    logger.error("current_pick_repair_failed", { errorType: error.name });
    res.status(500).json({
      error: "An error occurred while fixing current_pick",
      errorMessage: error.message,
    });
  }
});

// Route to reset current picks for all alive tracks of a specific user
router.put("/user/:userId/reset-current-picks", async (req, res) => {
  const userId = req.params.userId;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    // Find all alive tracks for this user that have a current pick
    const userAliveTracks = await Track.findAll({
      where: {
        user_id: userId,
        wrong_pick: null, // Only alive tracks
        current_pick: {
          [Op.and]: [
            { [Op.ne]: null }, // Not null
            { [Op.ne]: "" }, // Not empty string
          ],
        },
      },
      include: [
        {
          model: User,
          attributes: ["id", "first_name", "last_name", "username", "email"],
        },
      ],
    });

    if (!userAliveTracks || userAliveTracks.length === 0) {
      return res.status(404).json({
        message: "No alive tracks with current picks found for this user",
      });
    }

    const updatedTracks = [];
    const trackUpdates = [];

    // Process each track
    for (const track of userAliveTracks) {
      const currentPick = track.current_pick;
      let availablePicks = [...track.available_picks]; // Create a copy

      // Add current_pick back to available_picks if it's not already there
      if (currentPick && !availablePicks.includes(currentPick)) {
        availablePicks.push(currentPick);
      }

      // Remove current_pick from used_picks
      let usedPicks = [...track.used_picks]; // Create a copy
      if (currentPick) {
        usedPicks = usedPicks.filter((pick) => pick !== currentPick);
      }

      // Update the track: clear current_pick, update available_picks, and update used_picks
      trackUpdates.push(
        track.update({
          current_pick: null,
          available_picks: availablePicks,
          used_picks: usedPicks,
        })
      );

      updatedTracks.push({
        trackId: track.id,
        userId: track.user_id,
        username: track.User ? track.User.username : "Unknown",
        resetPick: currentPick,
        newAvailablePicksCount: availablePicks.length,
      });
    }

    // Wait for all updates to complete
    await Promise.all(trackUpdates);

    res.json({
      message: `Successfully reset current picks for ${updatedTracks.length} alive tracks for user ${userId}`,
      userId: userId,
      username: userAliveTracks[0].User
        ? userAliveTracks[0].User.username
        : "Unknown",
      tracksReset: updatedTracks.length,
      resetTracks: updatedTracks,
    });
  } catch (error) {
    logger.error("user_current_pick_reset_failed", {
      errorType: error.name,
    });
    res.status(500).json({
      error: "An error occurred while resetting user's current picks",
      errorMessage: error.message,
    });
  }
});

// Route to move the last used pick back to available picks for all alive tracks of a specific user
// This is a cleanup route for when current_pick was already cleared but used_picks wasn't updated
router.put("/user/:userId/move-last-used-to-available", async (req, res) => {
  const userId = req.params.userId;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    // Find all alive tracks for this user
    const userAliveTracks = await Track.findAll({
      where: {
        user_id: userId,
        wrong_pick: null, // Only alive tracks
      },
      include: [
        {
          model: User,
          attributes: ["id", "first_name", "last_name", "username", "email"],
        },
      ],
    });

    if (!userAliveTracks || userAliveTracks.length === 0) {
      return res.status(404).json({
        message: "No alive tracks found for this user",
      });
    }

    const updatedTracks = [];
    const skippedTracks = [];
    const trackUpdates = [];

    // Process each track
    for (const track of userAliveTracks) {
      let usedPicks = [...track.used_picks]; // Create a copy
      let availablePicks = [...track.available_picks]; // Create a copy

      // Check if there are used picks to work with
      if (usedPicks.length === 0) {
        skippedTracks.push({
          trackId: track.id,
          reason: "No used picks to move back",
        });
        continue;
      }

      // Remove the last pick from used_picks
      const lastUsedPick = usedPicks.pop();

      // Add it back to available_picks if it's not already there
      if (!availablePicks.includes(lastUsedPick)) {
        availablePicks.push(lastUsedPick);
      }

      // Update the track
      trackUpdates.push(
        track.update({
          used_picks: usedPicks,
          available_picks: availablePicks,
        })
      );

      updatedTracks.push({
        trackId: track.id,
        userId: track.user_id,
        username: track.User ? track.User.username : "Unknown",
        movedPick: lastUsedPick,
        newUsedPicksCount: usedPicks.length,
        newAvailablePicksCount: availablePicks.length,
      });
    }

    // Wait for all updates to complete
    await Promise.all(trackUpdates);

    res.json({
      message: `Successfully moved last used pick back to available for ${updatedTracks.length} alive tracks for user ${userId}`,
      userId: userId,
      username: userAliveTracks[0].User
        ? userAliveTracks[0].User.username
        : "Unknown",
      tracksUpdated: updatedTracks.length,
      tracksSkipped: skippedTracks.length,
      updatedTracks: updatedTracks,
      skippedTracks: skippedTracks,
    });
  } catch (error) {
    logger.error("pick_restore_failed", { errorType: error.name });
    res.status(500).json({
      error: "An error occurred while moving last used pick back to available",
      errorMessage: error.message,
    });
  }
});

// Route to reduce used_picks to a specific length and update current_pick
router.put("/reduce-used-picks/:trackId/:targetLength", (req, res) => {
  const trackId = req.params.trackId;
  const targetLength = parseInt(req.params.targetLength);

  if (!trackId) {
    return res.status(400).json({ error: "Track ID is required" });
  }

  if (isNaN(targetLength) || targetLength < 0) {
    return res
      .status(400)
      .json({ error: "A valid target length (0 or greater) is required" });
  }

  // Fetch the track by its ID
  Track.findOne({
    where: {
      id: trackId,
    },
  })
    .then((dbTrack) => {
      if (!dbTrack) {
        return res.status(404).json({ message: "No track found with this id" });
      }

      // Retrieve the current arrays
      let usedPicks = [...dbTrack.used_picks]; // Create a copy
      let availablePicks = [...dbTrack.available_picks]; // Create a copy
      let currentPick = dbTrack.current_pick;

      // If used_picks is already at or below target length, no changes needed
      if (usedPicks.length <= targetLength) {
        return res.status(400).json({
          message: `Used picks array already has ${usedPicks.length} elements, which is <= target length of ${targetLength}`,
          currentUsedPicksLength: usedPicks.length,
          targetLength: targetLength,
        });
      }

      // Calculate how many picks to remove
      const picksToRemove = usedPicks.length - targetLength;

      // Get the picks that will be removed (from the end)
      const removedPicks = usedPicks.slice(-picksToRemove);

      // Remove the picks from used_picks
      usedPicks = usedPicks.slice(0, targetLength);

      // Add removed picks back to available_picks (if not already there)
      removedPicks.forEach((pick) => {
        if (pick !== "placeholder" && !availablePicks.includes(pick)) {
          availablePicks.push(pick);
        }
      });

      // Set current_pick to the last element in the shortened used_picks array
      // (or null if the array is now empty)
      if (usedPicks.length > 0) {
        currentPick = usedPicks[usedPicks.length - 1];
      } else {
        currentPick = null;
      }

      // Update the track with the modified values
      return dbTrack.update({
        used_picks: usedPicks,
        available_picks: availablePicks,
        current_pick: currentPick,
      });
    })
    .then((updatedTrack) => {
      res.json({
        message: `Successfully reduced used picks to ${targetLength} elements`,
        trackId: trackId,
        previousUsedPicksLength:
          updatedTrack.used_picks.length +
          (updatedTrack.used_picks.length - targetLength),
        newUsedPicksLength: updatedTrack.used_picks.length,
        newCurrentPick: updatedTrack.current_pick,
        updatedTrack: updatedTrack,
      });
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({
        error: "An error occurred while updating the track",
        errorMessage: err.message,
      });
    });
});

// Route to reduce used_picks to a specific length for ALL tracks that exceed the target length
router.put("/reduce-all-used-picks/:targetLength", async (req, res) => {
  const targetLength = parseInt(req.params.targetLength);

  if (isNaN(targetLength) || targetLength < 0) {
    return res
      .status(400)
      .json({ error: "A valid target length (0 or greater) is required" });
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
      let availablePicks = [...track.available_picks]; // Create a copy
      let currentPick = track.current_pick;

      const originalUsedPicksLength = usedPicks.length;

      // Only process tracks that exceed the target length
      if (usedPicks.length > targetLength) {
        // Calculate how many picks to remove
        const picksToRemove = usedPicks.length - targetLength;

        // Get the picks that will be removed (from the end)
        const removedPicks = usedPicks.slice(-picksToRemove);

        // Remove the picks from used_picks
        usedPicks = usedPicks.slice(0, targetLength);

        // Add removed picks back to available_picks (if not already there)
        removedPicks.forEach((pick) => {
          if (pick !== "placeholder" && !availablePicks.includes(pick)) {
            availablePicks.push(pick);
          }
        });

        // Set current_pick to the last element in the shortened used_picks array
        // (or null if the array is now empty)
        if (usedPicks.length > 0) {
          currentPick = usedPicks[usedPicks.length - 1];
        } else {
          currentPick = null;
        }

        // Update the track
        const updateData = {
          used_picks: usedPicks,
          available_picks: availablePicks,
          current_pick: currentPick,
        };

        trackUpdates.push(track.update(updateData));

        updatedTracks.push({
          trackId: track.id,
          userId: track.user_id,
          username: track.User ? track.User.username : "Unknown",
          originalUsedPicksLength: originalUsedPicksLength,
          newUsedPicksLength: usedPicks.length,
          removedPicks: removedPicks,
          newCurrentPick: currentPick,
          picksMovedToAvailable: removedPicks.filter(
            (pick) => pick !== "placeholder"
          ),
        });
      } else {
        // Track already at or below target length
        skippedTracks.push({
          trackId: track.id,
          userId: track.user_id,
          username: track.User ? track.User.username : "Unknown",
          currentUsedPicksLength: originalUsedPicksLength,
          reason: `Already at or below target length of ${targetLength}`,
        });
      }
    }

    // Wait for all updates to complete
    await Promise.all(trackUpdates);

    res.json({
      message: `Successfully reduced used picks to ${targetLength} elements for ${updatedTracks.length} tracks`,
      targetLength: targetLength,
      totalTracksProcessed: tracks.length,
      tracksUpdated: updatedTracks.length,
      tracksSkipped: skippedTracks.length,
      updatedTracks: updatedTracks,
      skippedTracks: skippedTracks,
    });
  } catch (error) {
    logger.error("used_pick_reduction_failed", { errorType: error.name });
    res.status(500).json({
      error: "An error occurred while reducing used picks",
      errorMessage: error.message,
    });
  }
});

// Route to fix wrong_pick for tracks with used_picks length lower than a specified value

module.exports = router;
