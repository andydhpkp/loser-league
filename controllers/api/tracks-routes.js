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
router.put("/:id", (req, res) => {
  // First, fetch the current track
  Track.findOne({
    where: {
      id: req.params.id,
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

      const index = availablePicks.indexOf(req.body.current_pick);

      if (index !== -1) {
        availablePicks.splice(index, 1); // Remove from available_picks
        usedPicks.push(req.body.current_pick); // Add to used_picks
      }

      // Use the setters to store the modified arrays
      dbTrack.available_picks = availablePicks;
      dbTrack.used_picks = usedPicks;

      // Update the current_pick property
      dbTrack.current_pick = req.body.current_pick;

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

module.exports = router;
