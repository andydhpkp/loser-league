const router = require("express").Router();
const { Team } = require("../../models/my-index");
const { logger } = require("../../server/lib/logger");

router.get("/", (req, res) => {
  Team.findAll({})
    .then((dbTeam) => {
      res.json(dbTeam);
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

router.get("/:id(\\d+)", (req, res) => {
  Team.findOne({
    where: {
      id: req.params.id,
    },
  })
    .then((dbTeam) => {
      if (!dbTeam) {
        res.status(404).json({ message: "No Team found with this id" });
        return;
      }
      res.json(dbTeam);
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

//get by team name
router.get("/team/:team_name", (req, res) => {
  Team.findOne({
    where: {
      team_name: req.params.team_name,
    },
  })
    .then((dbTeam) => {
      if (!dbTeam) {
        res.status(404).json({ message: "No team found with this teamname" });
        return;
      }
      res.json(dbTeam);
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

//Create new Team
router.post("/", (req, res) => {
  Team.create({
    team_name: req.body.team_name,
    team_logo: req.body.team_logo,
    team_record: req.body.team_record,
  })
    .then((dbTeam) => {
      res.json(dbTeam);
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

//update win/loss
router.put("/:id(\\d+)", (req, res) => {
  Team.update(req.body, {
    where: {
      id: req.params.id,
    },
  })
    .then((dbTeam) => {
      if (!dbTeam) {
        res.status(404).json({ message: "No Team found with this id" });
        return;
      }
      res.json(dbTeam);
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

//update win/loss by name
router.put("/team/:team_name", (req, res) => {
  Team.update(req.body, {
    where: {
      team_name: req.params.team_name,
    },
  })
    .then((dbTeam) => {
      if (!dbTeam) {
        res.status(404).json({ message: "No Team found with this id" });
        return;
      }
      res.json(dbTeam);
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

//delete
router.delete("/:id(\\d+)", (req, res) => {
  Team.destroy({
    where: {
      id: req.params.id,
    },
  })
    .then((dbTeam) => {
      if (!dbTeam) {
        res.status(404).json({ message: "No Team found with this id" });
        return;
      }
      res.json(dbTeam);
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

router.delete("/", (req, res) => {
  Team.destroy({
    where: {},
    truncate: true,
  })
    .then((dbTeam) => {
      if (!dbTeam) {
        res.status(404).json({ message: "All teams deleted" });
        return;
      }
      res.json(dbTeam);
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

// Reset all teams' records to 0-0
router.put("/reset-records", (req, res) => {
  Team.update(
    { team_record: "0,0" },
    {
      where: {},
    }
  )
    .then((dbTeam) => {
      if (!dbTeam) {
        res.status(404).json({ message: "No Teams found to update" });
        return;
      }
      res.json({ message: "All team records reset to 0-0" });
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

module.exports = router;
