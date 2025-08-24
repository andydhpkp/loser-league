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
  addWin(year, wasTie = false) {
    const currentRecord = this.user_record || [];
    const existingEntry = currentRecord.find((entry) => entry.year === year);

    if (existingEntry) {
      // Update existing entry if needed
      if (wasTie && !existingEntry.won_with_tie) {
        existingEntry.won_with_tie = true;
      }
    } else {
      // Add new entry
      currentRecord.push({
        year: year,
        won: true,
        won_with_tie: wasTie,
      });
    }

    this.user_record = currentRecord;
    return this.save();
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
