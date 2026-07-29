const assert = require("node:assert/strict");
const test = require("node:test");

const {
  assertDisposableTestDatabase,
} = require("../../config/test-database");

test("accepts a MySQL URL whose database name clearly contains test", () => {
  assert.doesNotThrow(() =>
    assertDisposableTestDatabase("mysql://user:pass@localhost/loser_league_test")
  );
});

test("rejects development and production-looking database URLs", () => {
  assert.throws(
    () =>
      assertDisposableTestDatabase(
        "mysql://user:pass@localhost/loser_league_db"
      ),
    /must contain "test"/
  );
});

test("rejects malformed database URLs", () => {
  assert.throws(
    () => assertDisposableTestDatabase("not-a-url"),
    /valid MySQL URL/
  );
});

test("accepts MariaDB test URLs and returns the parsed URL", () => {
  const parsed = assertDisposableTestDatabase(
    "mariadb://user:pass@localhost/league_TEST"
  );
  assert.equal(parsed.protocol, "mariadb:");
});

test("rejects non-MySQL protocols and empty database names", () => {
  assert.throws(
    () => assertDisposableTestDatabase("postgres://localhost/league_test"),
    /valid MySQL URL/
  );
  assert.throws(
    () => assertDisposableTestDatabase("mysql://localhost"),
    /must contain "test"/
  );
});
