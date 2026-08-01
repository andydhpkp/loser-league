const router = require("express").Router();
const { Track, User } = require("../../../models/my-index");
const { Op, Sequelize } = require("sequelize");
const { makePick } = require("../../../server/modules/tracks/pick-state");
const { logger } = require("../../../server/lib/logger");
const { requireAdmin } = require("../../../server/admin/require-admin");

router.get("/", requireAdmin, (req, res) => {
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
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

//Get not null tracks wrong_picks
router.get("/alive", requireAdmin, (req, res) => {
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
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

router.get("/wrong-pick-not-null", requireAdmin, (req, res) => {
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
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

router.get("/wrong-pick-not-null/:userId", requireAdmin, (req, res) => {
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
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
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
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

router.get("/:id(\\d+)", (req, res) => {
  Track.findOne({
    attributes: ["id", "wrong_pick"],
    where: {
      id: req.params.id,
    },
  })
    .then((dbTrack) => {
      if (!dbTrack) {
        res.status(404).json({ message: "No Track found with this id" });
        return;
      }
      res.json(dbTrack);
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
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
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

//Make Pick
router.put("/:id(\\d+)", requireAdmin, (req, res) => {
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

      const nextState = makePick(
        {
          availablePicks: dbTrack.available_picks,
          usedPicks: dbTrack.used_picks,
          currentPick: dbTrack.current_pick,
        },
        req.body.current_pick
      );

      dbTrack.available_picks = nextState.availablePicks;
      dbTrack.used_picks = nextState.usedPicks;
      dbTrack.current_pick = nextState.currentPick;

      // Now, save the track with the modified properties
      return dbTrack.save();
    })
    .then((updatedTrack) => {
      res.json(updatedTrack);
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

//Set Losing Team
router.put("/:id(\\d+)/loser", (req, res) => {
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
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
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
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

//delete
router.delete("/:id(\\d+)", (req, res) => {
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
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

// Get all alive tracks for a specific user
router.get("/user/:userId/alive", requireAdmin, (req, res) => {
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
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

module.exports = router;
