const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/connection");

// create Track model
class Track extends Model {}

Track.init(
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    available_picks: {
      type: DataTypes.TEXT,
      allowNull: false,
      get() {
        const data = this.getDataValue("available_picks");
        return data ? data.split(";") : [];
      },
      set(val) {
        if (Array.isArray(val)) {
          this.setDataValue("available_picks", val.join(";"));
        }
      },
    },
    //figure out how to make sure available != used
    used_picks: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const data = this.getDataValue("used_picks");
        return data ? data.split(";") : [];
      },
      set(val) {
        if (Array.isArray(val)) {
          this.setDataValue("used_picks", val.join(";"));
        }
      },
    },
    current_pick: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    wrong_pick: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "user",
        key: "id",
      },
    },
  },
  {
    sequelize,
    timestamps: false,
    freezeTableName: true,
    underscored: true,
    modelName: "track",
  }
);

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

module.exports = Track;
