const router = require("express").Router();
const bcrypt = require("bcrypt");
const { User, Track } = require("../../models/my-index");
const { requireAdmin } = require("../../server/admin/require-admin");
const { logger } = require("../../server/lib/logger");

const USER_SESSION_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
const USER_SESSION_COOKIE_NAME = "connect.sid";

function publicUser(dbUser) {
  return { id: dbUser.id, username: dbUser.username };
}

router.get("/", requireAdmin, (req, res) => {
  User.findAll({
    attributes: { exclude: ["password", "email"] },
    include: [
      {
        model: Track,
      },
    ],
  })
    .then((dbUser) => {
      res.json(dbUser);
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

router.get("/:id(\\d+)", (req, res) => {
  User.findOne({
    attributes: { exclude: ["password"] },
    where: {
      id: req.params.id,
    },
    /*         include: [
            {
                model: Credential,
                attributes: ['id', 'nickname', 'login_name', 'password', 'user_id']
            }
        ] */
  })
    .then((dbUser) => {
      if (!dbUser) {
        res.status(404).json({ message: "No user found with this id" });
        return;
      }
      res.json(dbUser);
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

//get by username
router.get("/username/:username", (req, res) => {
  User.findOne({
    attributes: ["id", "username", "first_name", "last_name", "user_record"],
    where: {
      username: req.params.username,
    },
  })
    .then((dbUser) => {
      if (!dbUser) {
        res.status(404).json({ message: "No user found with this username" });
        return;
      }
      res.json(dbUser);
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

//register new user
router.post("/", (req, res) => {
  User.create({
    first_name: req.body.first_name,
    last_name: req.body.last_name,
    username: req.body.username,
    email: req.body.email,
    password: req.body.password,
  })
    .then((dbUser) => {
      req.session.save(() => {
        req.session.user_id = dbUser.id;
        req.session.loggedIn = true;

        res.json(publicUser(dbUser));
      });
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

//login route
router.post("/login", (req, res) => {
  if (
    Object.hasOwn(req.body, "staySignedIn") &&
    typeof req.body.staySignedIn !== "boolean"
  ) {
    res.status(400).json({
      error: "INVALID_REQUEST",
      message: "Keep-signed-in choice must be a boolean",
    });
    return;
  }

  User.findOne({
    where: {
      username: req.body.username,
    },
  }).then((dbUser) => {
    if (!dbUser) {
      res.status(400).json({ message: "No user with that username" });
      return;
    }

    //use User model's password validator
    const validPassword = dbUser.checkPassword(req.body.password);

    if (!validPassword) {
      res.status(400).json({ message: "Incorrect password!" });
      return;
    }

    if (req.body.staySignedIn === true) {
      req.session.cookie.maxAge = USER_SESSION_MAX_AGE_MS;
    } else {
      req.session.cookie.maxAge = null;
    }
    req.session.user_id = dbUser.id;
    req.session.username = dbUser.username;
    req.session.loggedIn = true;

    req.session.save((error) => {
      if (error) {
        logger.error("route_operation_failed", { errorType: error.name });
        res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
        return;
      }

      res.json({ user: publicUser(dbUser), message: "You are now logged in!" });
    });
  }).catch((err) => {
    logger.error("route_operation_failed", { errorType: err.name });
    res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
  });
});

//get logged in id
router.get("/logged", (req, res) => {
  User.findOne({
    attributes: { exclude: ["password"] },
    where: {
      id: req.session.user_id,
    },
  })
    .then((dbUser) => {
      if (!dbUser) {
        res.status(400).json({ message: "did not work" });
        return;
      }
      res.json(dbUser);
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

//logout route
router.post("/logout", (req, res) => {
  if (req.session.loggedIn) {
    req.session.destroy((error) => {
      if (error) {
        logger.error("route_operation_failed", { errorType: error.name });
        res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
        return;
      }
      res.clearCookie(USER_SESSION_COOKIE_NAME, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
      res.status(204).end();
    });
  } else {
    res.status(404).end();
  }
});

//update
router.put("/:id(\\d+)", (req, res) => {
  User.update(req.body, {
    where: {
      id: req.params.id,
    },
  })
    .then((dbUser) => {
      if (!dbUser) {
        res.status(404).json({ message: "No user found with this id" });
        return;
      }
      res.json(dbUser);
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

//delete
router.delete("/:id(\\d+)", (req, res) => {
  User.destroy({
    where: {
      id: req.params.id,
    },
  })
    .then((dbUser) => {
      if (!dbUser) {
        res.status(404).json({ message: "No user found with this id" });
        return;
      }
      res.json(dbUser);
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

//delete by username
router.delete("/username/:username", (req, res) => {
  User.destroy({
    where: {
      username: req.params.username,
    },
  })
    .then((dbUser) => {
      if (!dbUser) {
        res.status(404).json({ message: "No user found with this username" });
        return;
      }
      res.json(dbUser);
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

router.post("/reset-password", (req, res) => {
  const { email, newPassword, newUsername } = req.body;

  User.findOne({
    where: {
      email: email,
    },
  })
    .then((user) => {
      if (!user) {
        return res
          .status(404)
          .json({ message: "No user with that email address!" });
      }

      // Hash the new password and update the user's record
      user.password = bcrypt.hashSync(newPassword, 10);

      //update if offered
      if (newUsername) {
        user.username = newUsername;
      }

      user
        .save()
        .then(() => {
          res.status(200).json({ message: "Password updated successfully!" });
        })
        .catch((err) => {
          logger.error("route_operation_failed", { errorType: err.name });
          res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
        });
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

// Add win to user's record
router.put("/:id/add-win", requireAdmin, (req, res) => {
  const { year, won_with_tie = false } = req.body;

  const validYear = Number.isInteger(year) && year >= 1000 && year <= 9999;
  const validTieFlag = typeof won_with_tie === "boolean";
  if (!validYear || !validTieFlag) {
    return res.status(400).json({
      message:
        "Year must be a four-digit integer and won_with_tie must be a boolean",
    });
  }

  User.findByPk(req.params.id)
    .then((user) => {
      if (!user) {
        res.status(404).json({ message: "No user found with this id" });
        return null;
      }

      return user.addWin(year, won_with_tie);
    })
    .then((updatedUser) => {
      if (!updatedUser) {
        return;
      }

      res.json({
        message: "Win added successfully",
        user_record: updatedUser.user_record,
        total_wins: updatedUser.getTotalWins(),
        clean_wins: updatedUser.getCleanWins(),
        tie_wins: updatedUser.getWinsWithTies(),
        crown_type: updatedUser.getCrownType(),
      });
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

// Get user's win statistics
router.get("/:id/wins", (req, res) => {
  User.findByPk(req.params.id)
    .then((user) => {
      if (!user) {
        return res.status(404).json({ message: "No user found with this id" });
      }

      res.json({
        user_id: user.id,
        username: user.username,
        user_record: user.user_record || [],
        total_wins: user.getTotalWins(),
        clean_wins: user.getCleanWins(),
        tie_wins: user.getWinsWithTies(),
        crown_type: user.getCrownType(),
      });
    })
    .catch((err) => {
      logger.error("route_operation_failed", { errorType: err.name });
      res.status(500).json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" });
    });
});

module.exports = router;
module.exports.USER_SESSION_MAX_AGE_MS = USER_SESSION_MAX_AGE_MS;
