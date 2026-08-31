const DATABASE_POOL = Object.freeze({
  max: 2,
  min: 0,
  acquire: 10_000,
  idle: 10_000,
});

function createDatabaseOptions() {
  return {
    pool: DATABASE_POOL,
    logging: false,
  };
}

module.exports = { DATABASE_POOL, createDatabaseOptions };
