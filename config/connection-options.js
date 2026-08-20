const DATABASE_POOL = Object.freeze({
  max: 2,
  min: 0,
  acquire: 10_000,
  idle: 10_000,
});

module.exports = { DATABASE_POOL };
