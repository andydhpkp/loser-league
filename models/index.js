const Sequelize = require("sequelize");
const sequelize = require("../config/connection");
const {
  User,
  Track,
  Team,
  LeagueSeason,
  Pick,
  ScheduleSnapshot,
  LeagueWeekOperation,
} = require("./my-index");

module.exports = {
  sequelize,
  Sequelize,
  User,
  Track,
  Team,
  LeagueSeason,
  Pick,
  ScheduleSnapshot,
  LeagueWeekOperation,
};
