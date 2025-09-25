const router = require("express").Router();
const { Track, User } = require("../../models/my-index");
const { Op, Sequelize } = require("sequelize");

//get all tracks
router.get("/", (req, res) => {
  Track.findAll({
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
  })
    .then((dbTrack) => {
      res.json(dbTrack);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json(err);
    });
});

//Get not null tracks wrong_picks
router.get("/alive", (req, res) => {
  Track.findAll({
    where: {
      wrong_pick: null,
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
  })
    .then((dbTrack) => {
      res.json(dbTrack);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json(err);
    });
});

router.get("/wrong-pick-not-null", (req, res) => {
  Track.findAll({
    where: {
      wrong_pick: {
        [Op.ne]: null, // This line ensures we fetch records where wrong_pick is NOT null
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
  })
    .then((dbTrack) => {
      res.json(dbTrack);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json(err);
    });
});

router.get("/wrong-pick-not-null/:userId", (req, res) => {
  const userId = req.params.userId;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  Track.findAll({
    where: {
      userId: userId, // Assuming you have a userId field to filter on a specific user
      wrong_pick: {
        [Op.ne]: null, // Fetch records where wrong_pick is NOT null
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
  })
    .then((dbTrack) => {
      res.json(dbTrack);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json(err);
    });
});

router.put("/reset-wrong-pick/:trackId", (req, res) => {
  const trackId = req.params.trackId;

  if (!trackId) {
    return res.status(400).json({ error: "Track ID is required" });
  }

  Track.update({ wrong_pick: null }, { where: { id: trackId } })
    .then(([rowsUpdate]) => {
      if (rowsUpdate === 0) {
        return res.status(404).json({ error: "No track found with this ID" });
      }
      res.json({ message: "Wrong pick reset successfully" });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json(err);
    });
});

router.get("/:id", (req, res) => {
  Track.findOne({
    where: {
      id: req.params.id,
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
  })
    .then((dbTrack) => {
      if (!dbTrack) {
        res.status(404).json({ message: "No Track found with this id" });
        return;
      }
      res.json(dbTrack);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json(err);
    });
});

//Create new Track
router.post("/", (req, res) => {
  Track.create({
    available_picks: req.body.available_picks,
    used_picks: req.body.used_picks,
    current_pick: req.body.current_pick,

    //change to req.session.user_id
    user_id: req.body.user_id,
  })
    .then((dbTrack) => {
      res.json(dbTrack);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json(err);
    });
});

//Make Pick
//Make Pick - Fixed version with database transactions
router.put("/:id", async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    // Fetch the track with a lock to prevent concurrent modifications
    const dbTrack = await Track.findOne({
      where: {
        id: req.params.id,
      },
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

    if (!dbTrack) {
      await transaction.rollback();
      return res.status(404).json({ message: "No track found with this id" });
    }

    // Retrieve and modify available_picks and used_picks using the getters
    let availablePicks = dbTrack.available_picks;
    let usedPicks = dbTrack.used_picks;
    const newPick = req.body.current_pick;

    // Always set the current pick first
    dbTrack.current_pick = newPick;

    // Handle array updates
    const index = availablePicks.indexOf(newPick);
    if (index !== -1) {
      // Pick exists in available_picks - normal flow
      availablePicks.splice(index, 1); // Remove from available_picks
      usedPicks.push(newPick); // Add to used_picks
    } else {
      // Pick not in available_picks - add to used_picks if not already there
      if (!usedPicks.includes(newPick)) {
        usedPicks.push(newPick);
      }
      console.warn(
        `Pick ${newPick} not found in available_picks for track ${req.params.id}`
      );
    }

    // Use the setters to store the modified arrays
    dbTrack.available_picks = availablePicks;
    dbTrack.used_picks = usedPicks;

    // Save with transaction
    const updatedTrack = await dbTrack.save({ transaction });

    // Commit the transaction
    await transaction.commit();

    res.json(updatedTrack);
  } catch (err) {
    // Rollback on error
    await transaction.rollback();
    console.error("Error updating track:", err);
    res.status(500).json({
      error: "Failed to update track",
      message: err.message,
    });
  }
});

//Set Losing Team
router.put("/:id/loser", (req, res) => {
  const { wrong_pick } = req.body;

  Track.update(
    { wrong_pick },
    {
      where: {
        id: req.params.id,
      },
    }
  )
    .then((dbTrack) => {
      if (!dbTrack || dbTrack[0] === 0) {
        // Also checking if no rows were affected
        res.status(404).json({ message: "No track found with this id" });
        return;
      }
      res.json(dbTrack);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json(err);
    });
});

router.put("/all-tracks/reset-current-pick", (req, res) => {
  Track.update({ current_pick: null }, { where: {} })
    .then(([rowsUpdate]) => {
      if (rowsUpdate === 0) {
        return res.status(404).json({ error: "No tracks found to update" });
      }
      res.json({ message: "Current pick reset successfully for all tracks" });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json(err);
    });
});

//delete
router.delete("/:id", (req, res) => {
  Track.destroy({
    where: {
      id: req.params.id,
    },
  })
    .then((dbTrack) => {
      if (!dbTrack) {
        res.status(404).json({ message: "No track found with this id" });
        return;
      }
      res.json(dbTrack);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json(err);
    });
});

// Get all alive tracks for a specific user
router.get("/user/:userId/alive", (req, res) => {
  Track.findAll({
    where: {
      user_id: req.params.userId,
      wrong_pick: null,
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
  })
    .then((dbTracks) => {
      if (!dbTracks || dbTracks.length === 0) {
        res
          .status(404)
          .json({ message: "No alive tracks found for this user" });
        return;
      }
      res.json(dbTracks);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json(err);
    });
});

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
  })
    .then((dbTrack) => {
      if (!dbTrack) {
        res.status(404).json({ message: "No track found with this id" });
        return;
      }

      // Retrieve and modify available_picks and used_picks using the getters
      let availablePicks = dbTrack.available_picks;
      let usedPicks = dbTrack.used_picks;

      // Add current pick back to available picks and remove from used picks
      if (dbTrack.current_pick) {
        availablePicks.push(dbTrack.current_pick);
        usedPicks = usedPicks.filter((pick) => pick !== dbTrack.current_pick);
      }

      // Set the new current pick
      dbTrack.current_pick = teamName;

      // Remove the new current pick from available picks and add to used picks
      availablePicks = availablePicks.filter((pick) => pick !== teamName);
      usedPicks.push(teamName);

      // Use the setters to store the modified arrays
      dbTrack.available_picks = availablePicks;
      dbTrack.used_picks = usedPicks;

      // Now, save the track with the modified properties
      return dbTrack.save();
    })
    .then((updatedTrack) => {
      res.json(updatedTrack);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json(err);
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
      return dbTrack.save();
    })
    .then((updatedTrack) => {
      res.json(updatedTrack);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json(err);
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
    console.error("Error deleting tracks:", error); // Log the error

    // Send the error message as a response
    res.status(500).json({
      error: "An error occurred while deleting tracks.",
      errorMessage: error.message,
    });
  }
});

// Get alive tracks with null current_pick
router.get("/all-tracks/alive-without-pick", (req, res) => {
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
  })
    .then((dbTrack) => {
      if (!dbTrack || dbTrack.length === 0) {
        res
          .status(404)
          .json({ message: "No alive tracks without a current pick found" });
        return;
      }
      res.json(dbTrack);
    })
    .catch((err) => {
      console.error(err);
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
      return dbTrack.save();
    })
    .then((updatedTrack) => {
      res.json(updatedTrack);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json(err);
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
      });
    })
    .then((updatedTrack) => {
      res.json({ message: "Track updated successfully", updatedTrack });
    })
    .catch((err) => {
      console.log(err);
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
  Track.findAll()
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
        });
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
      console.log(err);
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
      });
    })
    .then((updatedTrack) => {
      res.json({ message: "Track updated successfully", updatedTrack });
    })
    .catch((err) => {
      console.log(err);
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
      return dbTrack.update({ available_picks: availablePicks });
    })
    .then((updatedTrack) => {
      res.json({
        message: `Team ${teamName} added to available picks`,
        updatedTrack,
      });
    })
    .catch((err) => {
      console.log(err);
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
      });
    })
    .then((updatedTrack) => {
      res.json({
        message: `Team ${teamName} added to used picks`,
        updatedTrack,
      });
    })
    .catch((err) => {
      console.log(err);
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
      });
    })
    .then((updatedTrack) => {
      res.json({
        message:
          "Used picks reset with placeholders and moved to available picks",
        updatedTrack,
      });
    })
    .catch((err) => {
      console.log(err);
      res
        .status(500)
        .json({ error: "An error occurred while updating the track" });
    });
});

// Route to automatically make picks for alive tracks without current picks
const forcePickExecutions = new Map(); // trackId -> timestamp
const FORCE_PICK_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const GLOBAL_FORCE_PICK_LOCK = { isRunning: false, lastExecution: null };

router.put("/force-picks/all-alive", async (req, res) => {
  try {
    // GUARD 1: Check if force-pick is already running globally
    if (GLOBAL_FORCE_PICK_LOCK.isRunning) {
      return res.status(429).json({
        error: "Force-pick is already in progress. Please wait.",
        lastExecution: GLOBAL_FORCE_PICK_LOCK.lastExecution,
      });
    }

    // GUARD 2: Check if force-pick was executed recently (within 1 hour)
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    if (
      GLOBAL_FORCE_PICK_LOCK.lastExecution &&
      now - GLOBAL_FORCE_PICK_LOCK.lastExecution < oneHour
    ) {
      return res.status(429).json({
        error:
          "Force-pick executed too recently. Must wait at least 1 hour between executions.",
        lastExecution: new Date(
          GLOBAL_FORCE_PICK_LOCK.lastExecution
        ).toISOString(),
        timeUntilNext: new Date(
          GLOBAL_FORCE_PICK_LOCK.lastExecution + oneHour
        ).toISOString(),
      });
    }

    // GUARD 3: Set global lock
    GLOBAL_FORCE_PICK_LOCK.isRunning = true;
    console.log("🔒 Force-pick lock acquired at", new Date().toISOString());

    // Find all alive tracks without current picks
    const tracksNeedingPicks = await Track.findAll({
      where: {
        wrong_pick: null,
        [Op.or]: [{ current_pick: null }, { current_pick: "" }],
      },
      include: [
        {
          model: User,
          attributes: ["id", "first_name", "last_name", "username", "email"],
        },
      ],
    });

    if (!tracksNeedingPicks || tracksNeedingPicks.length === 0) {
      // Release lock before returning
      GLOBAL_FORCE_PICK_LOCK.isRunning = false;
      GLOBAL_FORCE_PICK_LOCK.lastExecution = now;

      return res.status(404).json({
        message: "No alive tracks without current picks found",
      });
    }

    const updatedTracks = [];
    const errors = [];

    // Process each track that needs a pick
    for (const track of tracksNeedingPicks) {
      try {
        // GUARD 4: Check individual track cooldown
        const lastPickTime = forcePickExecutions.get(track.id);
        if (lastPickTime && now - lastPickTime < FORCE_PICK_COOLDOWN) {
          errors.push({
            trackId: track.id,
            userId: track.user_id,
            username: track.User ? track.User.username : "Unknown",
            error: "Track was force-picked too recently (24hr cooldown)",
          });
          continue;
        }

        // Get available picks for this track
        let availablePicks = track.available_picks;
        let usedPicks = track.used_picks;

        // Check if there are available picks
        if (!availablePicks || availablePicks.length === 0) {
          errors.push({
            trackId: track.id,
            userId: track.user_id,
            username: track.User ? track.User.username : "Unknown",
            error: "No available picks remaining",
          });
          continue;
        }

        // Select a random pick from available picks
        const randomIndex = Math.floor(Math.random() * availablePicks.length);
        const selectedPick = availablePicks[randomIndex];

        // Remove the selected pick from available picks
        availablePicks.splice(randomIndex, 1);

        // Add the selected pick to used picks
        usedPicks.push(selectedPick);

        // Update the track with the new pick
        track.available_picks = availablePicks;
        track.used_picks = usedPicks;
        track.current_pick = selectedPick;

        // Save the updated track
        const updatedTrack = await track.save();

        // GUARD 5: Record this execution for the track
        forcePickExecutions.set(track.id, now);

        updatedTracks.push({
          trackId: track.id,
          userId: track.user_id,
          username: track.User ? track.User.username : "Unknown",
          selectedPick: selectedPick,
          remainingAvailable: availablePicks.length,
        });

        console.log(`✅ Force-picked ${selectedPick} for track ${track.id}`);
      } catch (error) {
        errors.push({
          trackId: track.id,
          userId: track.user_id,
          username: track.User ? track.User.username : "Unknown",
          error: error.message,
        });
      }
    }

    // GUARD 6: Update global execution time and release lock
    GLOBAL_FORCE_PICK_LOCK.lastExecution = now;
    GLOBAL_FORCE_PICK_LOCK.isRunning = false;
    console.log("🔓 Force-pick lock released at", new Date().toISOString());

    // Prepare response
    const response = {
      message: `Auto-pick completed for ${updatedTracks.length} tracks`,
      updatedTracks: updatedTracks,
      totalProcessed: tracksNeedingPicks.length,
      successCount: updatedTracks.length,
      errorCount: errors.length,
      executionTime: new Date(now).toISOString(),
    };

    if (errors.length > 0) {
      response.errors = errors;
    }

    res.json(response);
  } catch (error) {
    // GUARD 7: Always release lock on error
    GLOBAL_FORCE_PICK_LOCK.isRunning = false;
    console.error("❌ Error in force-pick route, lock released:", error);

    res.status(500).json({
      error: "An error occurred while processing auto-picks",
      errorMessage: error.message,
    });
  }
});

// Route to reset all tracks to a specific number of picks
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
    console.error("Error resetting tracks:", error);
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
    console.error("Error fixing current_pick:", error);
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
    console.error("Error resetting user's current picks:", error);
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
    console.error("Error moving last used pick back to available:", error);
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
      console.log(err);
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
    console.error("Error reducing used picks:", error);
    res.status(500).json({
      error: "An error occurred while reducing used picks",
      errorMessage: error.message,
    });
  }
});

module.exports = router;
