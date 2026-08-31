const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  DATABASE_POOL,
  createDatabaseOptions,
} = require("../../config/connection-options");

test("production database options suppress ORM query logging", () => {
  assert.deepEqual(createDatabaseOptions(), {
    pool: DATABASE_POOL,
    logging: false,
  });
});
