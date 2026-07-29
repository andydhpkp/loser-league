const Sequelize = require("sequelize");
require("dotenv").config();
const {
  assertDisposableTestDatabase,
} = require("./test-database");

//create connection to db
let sequelize;

if (process.env.NODE_ENV === "test") {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL is required when NODE_ENV=test");
  }
  assertDisposableTestDatabase(process.env.TEST_DATABASE_URL);
  sequelize = new Sequelize(process.env.TEST_DATABASE_URL, {
    logging: false,
  });
} else if (process.env.JAWSDB_URL) {
  sequelize = new Sequelize(process.env.JAWSDB_URL);
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PW,
    {
      host: "127.0.0.1",
      dialect: "mysql",
      port: 3306,
    }
  );
}

module.exports = sequelize;
