const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/connection");
const bcrypt = require("bcrypt");

// create User model
class User extends Model {
  // set up method to run on instance data (per user) to check password
  checkPassword(loginPw) {
    return bcrypt.compareSync(loginPw, this.password);
  }

  // Helper method to add a win to user's record
  addWin(year, wasTie = false, saveOptions = {}) {
    const currentRecord = this.user_record || [];
    const existingEntryIndex = currentRecord.findIndex(
      (entry) => entry.year === year
    );

    if (existingEntryIndex !== -1) {
      this.user_record = currentRecord.map((entry, index) =>
        index === existingEntryIndex && wasTie && !entry.won_with_tie
          ? { ...entry, won_with_tie: true }
          : entry
      );
    } else {
      this.user_record = [
        ...currentRecord,
        {
          year: year,
          won: true,
          won_with_tie: wasTie,
        },
      ];
    }

    this.changed("user_record", true);
    return this.save(saveOptions);
  }

  // Helper method to get total wins
  getTotalWins() {
    return this.user_record
      ? this.user_record.filter((entry) => entry.won).length
      : 0;
  }

  // Helper method to get wins with ties
  getWinsWithTies() {
    return this.user_record
      ? this.user_record.filter((entry) => entry.won_with_tie).length
      : 0;
  }

  // Helper method to get clean wins (won without ties)
  getCleanWins() {
    return this.user_record
      ? this.user_record.filter((entry) => entry.won && !entry.won_with_tie)
          .length
      : 0;
  }

  // Derive a stable presentation key from the User's complete win history.
  getCrownType() {
    const soloWins = this.getCleanWins();
    const tiedWins = this.user_record
      ? this.user_record.filter((entry) => entry.won && entry.won_with_tie)
          .length
      : 0;

    if (soloWins === 0 && tiedWins === 0) {
      return null;
    }

    const crownParts = [];
    if (soloWins > 0) {
      crownParts.push(`solo_${soloWins}`);
    }
    if (tiedWins > 0) {
      crownParts.push(`tied_${tiedWins}`);
    }
    return crownParts.join("_");
  }
}

// create columns for User model
User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    first_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    last_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    user_record: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment:
        "Array of objects tracking league wins by year: [{year: 2025, won: true, won_with_tie: false}]",
    },
    crown_type: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.getCrownType();
      },
    },
  },
  {
    hooks: {
      // set up beforeCreate lifecycle "hook" functionality
      async beforeCreate(newUserData) {
        newUserData.password = await bcrypt.hash(newUserData.password, 10);
        return newUserData;
      },
    },
    sequelize,
    timestamps: false,
    freezeTableName: true,
    underscored: true,
    modelName: "user",
  }
);

module.exports = User;
