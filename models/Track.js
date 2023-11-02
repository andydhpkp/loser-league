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

// Route to delete tracks with non-null wrong_pick
router.delete("/delete-wrong-pick", async (req, res) => {
  try {
    // Find and delete tracks with non-null wrong_pick
    const deletedTracks = await Track.destroy({
      where: {
        wrong_pick: {
          [Sequelize.Op.not]: null,
        },
      },
    });

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
    console.error("Error deleting tracks:", error);
    res.status(500).json({ error: "An error occurred while deleting tracks." });
  }
});

module.exports = Track;
