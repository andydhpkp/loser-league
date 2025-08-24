const router = require("express").Router();
const bcrypt = require("bcrypt");
const { User, Track } = require("../../models/my-index");

router.get("/", (req, res) => {
  User.findAll({
    //attributes: { exclude: ['password'] }
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
      console.log(err);
      res.status(500).json(err);
    });
});

router.get("/:id", (req, res) => {
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
      console.log(err);
      res.status(500).json(err);
    });
});

//get by username
router.get("/username/:username", (req, res) => {
  User.findOne({
    where: {
      username: req.params.username,
    },
    include: [
      {
        model: Track,
        where: {
          wrong_pick: null,
        },
        required: false, // This makes the JOIN LEFT OUTER instead of INNER, so that users without matching tracks are still returned.
      },
    ],
  })
    .then((dbUser) => {
      if (!dbUser) {
        res.status(404).json({ message: "No user found with this username" });
        return;
      }
      res.json(dbUser);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json(err);
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

        res.json(dbUser);
      });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json(err);
    });
});

//login route
router.post("/login", (req, res) => {
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
    console.log("this is req.password " + JSON.stringify(req.body));
    const validPassword = dbUser.checkPassword(req.body.password);

    if (!validPassword) {
      res.status(400).json({ message: "Incorrect password!" });
      return;
    }

    req.session.save(() => {
      if (req.body.staySignedIn) {
        //logged in for 10 years
        req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 365 * 10;
      } else {
        req.session.cookie.expires = false;
      }
      req.session.user_id = dbUser.id;
      req.session.username = dbUser.username;
      req.session.loggedIn = true;

      res.json({ user: dbUser, message: "You are now logged in!" });
    });
  });
});

//get logged in id
router.get("/logged", (req, res) => {
  User.findOne({
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
      console.log(err);
      res.status(500).json(err);
    });
});

//logout route
router.post("/logout", (req, res) => {
  if (req.session.loggedIn) {
    req.session.destroy(() => {
      res.status(204).end();
    });
  } else {
    res.status(404).end();
  }
});

//update
router.put("/:id", (req, res) => {
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
      console.log(err);
      res.status(500).json(err);
    });
});

//delete
router.delete("/:id", (req, res) => {
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
      console.log(err);
      res.status(500).json(err);
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
      console.log(err);
      res.status(500).json(err);
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
          console.log(err);
          res.status(500).json(err);
        });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json(err);
    });
});

// Add win to user's record
// Add win to user's record
router.put("/:id/add-win", (req, res) => {
  const { year, won_with_tie = false } = req.body;

  if (!year) {
    return res.status(400).json({ message: "Year is required" });
  }

  User.findByPk(req.params.id)
    .then((user) => {
      if (!user) {
        return res.status(404).json({ message: "No user found with this id" });
      }

      const currentRecord = user.user_record || [];
      const existingEntryIndex = currentRecord.findIndex(
        (entry) => entry.year === year
      );

      let newRecord;

      if (existingEntryIndex !== -1) {
        // Update existing entry if needed
        newRecord = [...currentRecord]; // Create a new array
        if (won_with_tie && !newRecord[existingEntryIndex].won_with_tie) {
          newRecord[existingEntryIndex] = {
            ...newRecord[existingEntryIndex],
            won_with_tie: true,
          };
        }
      } else {
        // Add new entry
        newRecord = [
          ...currentRecord,
          {
            year: year,
            won: true,
            won_with_tie: won_with_tie,
          },
        ];
      }

      // Set the new array and mark the field as changed
      user.user_record = newRecord;
      user.changed("user_record", true);

      return user.save();
    })
    .then((updatedUser) => {
      res.json({
        message: "Win added successfully",
        user_record: updatedUser.user_record,
        total_wins: updatedUser.getTotalWins(),
        clean_wins: updatedUser.getCleanWins(),
        tie_wins: updatedUser.getWinsWithTies(),
      });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json(err);
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
      });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json(err);
    });
});

module.exports = router;
