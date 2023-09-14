const router = require("express").Router();
const { Track, User } = require("../../models/my-index");
const { Op } = require("sequelize");

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

router.put("/reset-current-pick", (req, res) => {
  Track.update({ current_pick: null }, {})
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

module.exports = router;
