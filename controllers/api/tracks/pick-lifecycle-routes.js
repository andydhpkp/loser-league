const router = require("express").Router();
const { requireAdmin } = require("../../../server/admin/require-admin");
const { legacyEmergencyRepair } = require("../../../server/admin/legacy-emergency-repair");

router.use(requireAdmin, legacyEmergencyRepair);
const { Track, User } = require("../../../models/my-index");
const { Op, Sequelize } = require("sequelize");
const {
  replaceCurrentPick,
} = require("../../../server/modules/tracks/pick-state");
const { logger } = require("../../../server/lib/logger");

router.put("/quick-replace/:trackId", (req, res) => {
  const trackId = req.params.trackId;
  const { teamName } = req.body;

  if (!trackId || !teamName) {
    return res
      .status(400)
      .json({ error: "Track ID and team name are required" });
  }

  // First, fetch the current track
  Track.findOne({
    where: {
      id: trackId,
    },
    transaction: res.locals.legacyEmergencyTransaction,
  })
    .then((dbTrack) => {
      if (!dbTrack) {
        res.status(404).json({ message: "No track found with this id" });
        return;
      }

      const nextState = replaceCurrentPick(
        {
          availablePicks: dbTrack.available_picks,
          usedPicks: dbTrack.used_picks,
          currentPick: dbTrack.current_pick,
        },
        teamName
      );

      dbTrack.current_pick = nextState.currentPick;
      dbTrack.available_picks = nextState.availablePicks;
      dbTrack.used_picks = nextState.usedPicks;

      // Now, save the track with the modified properties
      return dbTrack.save({ transaction: res.locals.legacyEmergencyTransaction });
    })
    .then((updatedTrack) => {
      res.json(updatedTrack);
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

router.put("/add-placeholder/:trackId", (req, res) => {
  const trackId = req.params.trackId;

  if (!trackId) {
    return res.status(400).json({ error: "Track ID is required" });
  }

  // Fetch the current track
  Track.findOne({
    where: {
      id: trackId,
    },
    transaction: res.locals.legacyEmergencyTransaction,
  })
    .then((dbTrack) => {
      if (!dbTrack) {
        res.status(404).json({ message: "No track found with this id" });
        return;
      }

      // Retrieve the current used_picks using the getter
      let usedPicks = dbTrack.used_picks;

      // Add "placeholder" to the used_picks
      usedPicks.push("placeholder");

      // Use the setter to store the modified used_picks array
      dbTrack.used_picks = usedPicks;

      // Save the track with the modified used_picks
      return dbTrack.save({ transaction: res.locals.legacyEmergencyTransaction });
    })
    .then((updatedTrack) => {
      res.json(updatedTrack);
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

// Route to delete tracks with non-null wrong_pick in batches
router.delete("/clear-memory/delete-wrong-pick", async (req, res) => {
  try {
    const batchSize = 100; // Adjust the batch size as needed
    let deletedTracks = 0;

    while (true) {
      // Find and delete tracks with non-null wrong_pick in batches
      const result = await Track.destroy({
        where: {
          wrong_pick: {
            [Sequelize.Op.not]: null,
          },
        },
        limit: batchSize, // Set the batch size
        transaction: res.locals.legacyEmergencyTransaction,
      });

      if (result === 0) {
        // No more tracks to delete
        break;
      }

      deletedTracks += result;
    }

    if (deletedTracks > 0) {
      res
        .status(200)
        .json({ message: `${deletedTracks} tracks deleted successfully.` });
    } else {
      res
        .status(404)
        .json({ message: "No tracks with non-null wrong_pick found." });
    }
  } catch (error) {
    logger.error("track_cleanup_failed", { errorType: error.name });

    // Send the error message as a response
    res.status(500).json({
      error: "An error occurred while deleting tracks.",
      errorMessage: error.message,
    });
  }
});

// Get alive tracks with null current_pick
router.get("/all-tracks/alive-without-pick", (req, res) => {
  // Temporary fix, update next year
  // Hardcode week number based on actual date
  // Week 1: Sep 5, 2024 (Thursday)
  // Each subsequent week is 7 days later
  const now = new Date();
  const week1Start = new Date('2024-09-05T00:00:00-06:00'); // Week 1 Thursday in Mountain Time
  const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000;

  const weeksSinceStart = Math.floor((now - week1Start) / millisecondsPerWeek);
  const weekNumber = weeksSinceStart + 1;

  logger.debug("week_number_calculated", {
    weekNumber,
    date: now.toISOString(),
  });

  // Validate calculated weekNumber
  if (weekNumber < 1 || weekNumber > 18) {
    return res.status(400).json({
      error: `Invalid calculated week number: ${weekNumber}. Season may not have started or may be over.`
    });
  }

  Track.findAll({
    where: {
      wrong_pick: null, // Tracks that are still "alive"
      current_pick: {
        [Op.or]: ["", null], // Match both empty string and null
      },
    },
    include: [
      {
        model: User,
        attributes: [
          "id",
          "first_name",
          "last_name",
          "username",
          "email",
          "password",
        ],
      },
    ],
    transaction: res.locals.legacyEmergencyTransaction,
  })
    .then((dbTracks) => {
      if (!dbTracks || dbTracks.length === 0) {
        res
          .status(404)
          .json({ message: "No alive tracks without a current pick found" });
        return;
      }

      // Filter tracks to only include those that haven't made enough picks yet
      // A track needs a pick if used_picks.length < weekNumber
      const tracksNeedingPicks = dbTracks.filter((track) => {
        const usedPicks = track.used_picks || [];
        return usedPicks.length < weekNumber;
      });

      if (tracksNeedingPicks.length === 0) {
        res
          .status(404)
          .json({
            message: `No alive tracks found that need picks for week ${weekNumber}. All tracks have already made ${weekNumber} or more picks.`
          });
        return;
      }

      res.json(tracksNeedingPicks);
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ message: "Failed to fetch alive tracks" });
    });
});

router.put("/remove-placeholder/:trackId", (req, res) => {
  const trackId = req.params.trackId;

  if (!trackId) {
    return res.status(400).json({ error: "Track ID is required" });
  }

  // Fetch the current track
  Track.findOne({
    where: {
      id: trackId,
    },
    transaction: res.locals.legacyEmergencyTransaction,
  })
    .then((dbTrack) => {
      if (!dbTrack) {
        res.status(404).json({ message: "No track found with this id" });
        return;
      }

      // Retrieve the current used_picks using the getter
      let usedPicks = dbTrack.used_picks;

      // Remove "placeholder" from the used_picks
      usedPicks = usedPicks.filter((pick) => pick !== "placeholder");

      // Use the setter to store the modified used_picks array
      dbTrack.used_picks = usedPicks;

      // Save the track with the modified used_picks
      return dbTrack.save({ transaction: res.locals.legacyEmergencyTransaction });
    })
    .then((updatedTrack) => {
      res.json(updatedTrack);
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

router.put("/update-recent-pick-remove-and-add/:trackId", (req, res) => {
  const trackId = req.params.trackId;

  if (!trackId) {
    return res.status(400).json({ error: "Track ID is required" });
  }

  // Fetch the track by its ID
  Track.findOne({
    where: {
      id: trackId,
    },
    transaction: res.locals.legacyEmergencyTransaction,
  })
    .then((dbTrack) => {
      if (!dbTrack) {
        return res.status(404).json({ message: "No track found with this id" });
      }

      // Retrieve the current used_picks and current_pick
      let usedPicks = dbTrack.used_picks;
      let currentPick = dbTrack.current_pick;

      // Check if there are used picks to work with
      if (usedPicks.length > 0) {
        // Remove the current most recent used pick
        const lastUsedPick = usedPicks.pop();

        // Clear the current pick
        currentPick = null;

        // Set the new most recent used pick (after removal) as the current pick
        if (usedPicks.length > 0) {
          currentPick = usedPicks[usedPicks.length - 1]; // New most recent pick
        }

        // Add the new most recent pick to current_pick (it stays in used_picks)
      }

      // Update the track with the modified values
      return dbTrack.update({
        used_picks: usedPicks,
        current_pick: currentPick,
      }, { transaction: res.locals.legacyEmergencyTransaction });
    })
    .then((updatedTrack) => {
      res.json({ message: "Track updated successfully", updatedTrack });
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res
        .status(500)
        .json({ error: "An error occurred while updating the track" });
    });
});

// Route to remove excess used picks and clear wrong_pick if necessary
router.put("/remove-excess-used-picks/:limit", (req, res) => {
  const limit = parseInt(req.params.limit);

  if (isNaN(limit) || limit < 0) {
    return res.status(400).json({ error: "A valid limit is required" });
  }

  // Fetch all tracks
  Track.findAll({ transaction: res.locals.legacyEmergencyTransaction })
    .then((tracks) => {
      // Iterate through each track and process the used_picks and wrong_pick
      const updatePromises = tracks.map((track) => {
        let usedPicks = track.used_picks;
        let wrongPick = track.wrong_pick;

        // If the number of used picks exceeds the limit, remove excess picks
        if (usedPicks.length > limit) {
          usedPicks = usedPicks.slice(0, limit);
        }

        // If the wrong_pick is not null and there is no matching pick in used_picks, clear the wrong_pick
        if (wrongPick && !usedPicks.includes(wrongPick)) {
          wrongPick = null;
        }

        // Update the track with modified values
        return track.update({
          used_picks: usedPicks,
          wrong_pick: wrongPick,
        }, { transaction: res.locals.legacyEmergencyTransaction });
      });

      // Wait for all the updates to complete
      return Promise.all(updatePromises);
    })
    .then((updatedTracks) => {
      res.json({
        message: `Tracks updated successfully`,
        updatedTracks,
      });
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res
        .status(500)
        .json({ error: "An error occurred while updating tracks" });
    });
});

// Route to remove the last item from used_picks, move it to available_picks, and clear current_pick if it exists
router.put("/remove-last-used-pick/:trackId", (req, res) => {
  const trackId = req.params.trackId;

  if (!trackId) {
    return res.status(400).json({ error: "Track ID is required" });
  }

  // Fetch the track by its ID
  Track.findOne({
    where: {
      id: trackId,
    },
    transaction: res.locals.legacyEmergencyTransaction,
  })
    .then((dbTrack) => {
      if (!dbTrack) {
        return res.status(404).json({ message: "No track found with this id" });
      }

      // Retrieve the current used_picks, available_picks, and current_pick
      let usedPicks = dbTrack.used_picks;
      let availablePicks = dbTrack.available_picks;
      let currentPick = dbTrack.current_pick;

      // Check if there are used picks to remove
      if (usedPicks.length > 0) {
        // Remove the last item from used_picks
        const lastUsedPick = usedPicks.pop();

        // Add the removed pick back to available_picks if it's not already present
        if (!availablePicks.includes(lastUsedPick)) {
          availablePicks.push(lastUsedPick);
        }
      }

      // Remove current_pick if it is not empty
      if (currentPick) {
        currentPick = null;
      }

      // Update the track with the modified values
      return dbTrack.update({
        used_picks: usedPicks,
        available_picks: availablePicks,
        current_pick: currentPick,
      }, { transaction: res.locals.legacyEmergencyTransaction });
    })
    .then((updatedTrack) => {
      res.json({ message: "Track updated successfully", updatedTrack });
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res
        .status(500)
        .json({ error: "An error occurred while updating the track" });
    });
});

// Route to add a team to available_picks
router.put("/add-to-available-picks/:trackId", (req, res) => {
  const trackId = req.params.trackId;
  const { teamName } = req.body;

  if (!trackId || !teamName) {
    return res
      .status(400)
      .json({ error: "Track ID and team name are required" });
  }

  // Fetch the track by its ID
  Track.findOne({
    where: {
      id: trackId,
    },
    transaction: res.locals.legacyEmergencyTransaction,
  })
    .then((dbTrack) => {
      if (!dbTrack) {
        return res.status(404).json({ message: "No track found with this id" });
      }

      // Retrieve the current available_picks
      let availablePicks = dbTrack.available_picks;

      // Add the team to available_picks if it's not already there
      if (!availablePicks.includes(teamName)) {
        availablePicks.push(teamName);
      } else {
        return res
          .status(400)
          .json({ message: "Team already exists in available_picks" });
      }

      // Update the track with the modified available_picks
      return dbTrack.update({ available_picks: availablePicks }, { transaction: res.locals.legacyEmergencyTransaction });
    })
    .then((updatedTrack) => {
      res.json({
        message: `Team ${teamName} added to available picks`,
        updatedTrack,
      });
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res
        .status(500)
        .json({ error: "An error occurred while updating the track" });
    });
});

// Route to add a team to used_picks
router.put("/add-to-used-picks/:trackId", (req, res) => {
  const trackId = req.params.trackId;
  const { teamName } = req.body;

  if (!trackId || !teamName) {
    return res
      .status(400)
      .json({ error: "Track ID and team name are required" });
  }

  // Fetch the track by its ID
  Track.findOne({
    where: {
      id: trackId,
    },
    transaction: res.locals.legacyEmergencyTransaction,
  })
    .then((dbTrack) => {
      if (!dbTrack) {
        return res.status(404).json({ message: "No track found with this id" });
      }

      // Retrieve the current used_picks and available_picks
      let usedPicks = dbTrack.used_picks;
      let availablePicks = dbTrack.available_picks;

      // Add the team to used_picks if it's not already there
      if (!usedPicks.includes(teamName)) {
        usedPicks.push(teamName);

        // Optionally, remove the team from available_picks if it exists there
        availablePicks = availablePicks.filter((pick) => pick !== teamName);
      } else {
        return res
          .status(400)
          .json({ message: "Team already exists in used_picks" });
      }

      // Update the track with the modified used_picks and available_picks
      return dbTrack.update({
        used_picks: usedPicks,
        available_picks: availablePicks,
      }, { transaction: res.locals.legacyEmergencyTransaction });
    })
    .then((updatedTrack) => {
      res.json({
        message: `Team ${teamName} added to used picks`,
        updatedTrack,
      });
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res
        .status(500)
        .json({ error: "An error occurred while updating the track" });
    });
});

//RESET ALL PICKS, USING FOR PLAYOFFS
router.put("/reset-picks/:trackId", (req, res) => {
  const trackId = req.params.trackId;

  if (!trackId) {
    return res.status(400).json({ error: "Track ID is required" });
  }

  // Fetch the track by its ID
  Track.findOne({
    where: {
      id: trackId,
    },
    transaction: res.locals.legacyEmergencyTransaction,
  })
    .then((dbTrack) => {
      if (!dbTrack) {
        return res.status(404).json({ message: "No track found with this ID" });
      }

      // Retrieve the current used_picks and available_picks
      let usedPicks = dbTrack.used_picks;
      let availablePicks = dbTrack.available_picks;

      // Move all items from used_picks to available_picks
      usedPicks.forEach((pick) => {
        if (!availablePicks.includes(pick)) {
          availablePicks.push(pick);
        }
      });

      // Replace each moved item in used_picks with "placeholder"
      usedPicks = usedPicks.map(() => "placeholder");

      // Update the track with the modified values
      return dbTrack.update({
        available_picks: availablePicks,
        used_picks: usedPicks,
      }, { transaction: res.locals.legacyEmergencyTransaction });
    })
    .then((updatedTrack) => {
      res.json({
        message:
          "Used picks reset with placeholders and moved to available picks",
        updatedTrack,
      });
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res
        .status(500)
        .json({ error: "An error occurred while updating the track" });
    });
});

// Route to automatically make picks for alive tracks without current picks

module.exports = router;
