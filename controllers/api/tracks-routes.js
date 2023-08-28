const router = require("express").Router();
const { Track, User } = require("../../models/my-index");

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

//Get not null tracks
router.get("/", (req, res) => {
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
  Track.update(req.body, {
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

module.exports = router;
