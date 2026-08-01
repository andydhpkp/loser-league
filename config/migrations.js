require("dotenv").config();

const { assertDisposableTestDatabase } = require("./test-database");

const development = {
  username: process.env.DB_USER,
  password: process.env.DB_PW,
  database: process.env.DB_NAME,
  host: "127.0.0.1",
  port: 3306,
  dialect: "mysql",
  logging: false,
};

let test;
if (process.env.TEST_DATABASE_URL) {
  assertDisposableTestDatabase(process.env.TEST_DATABASE_URL);
  test = {
    use_env_variable: "TEST_DATABASE_URL",
    dialect: "mysql",
    logging: false,
  };
} else {
  test = {
    username: "missing-test-database-url",
    database: "missing_test_database_url",
    dialect: "mysql",
  };
}

module.exports = {
  development,
  test,
  production: {
    use_env_variable: "JAWSDB_URL",
    dialect: "mysql",
    logging: false,
  },
};
