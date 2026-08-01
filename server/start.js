async function startServer({ app, database, port, logger }) {
  await database.authenticate();

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      logger.info("server_started", { port });
      queueMicrotask(() => resolve(server));
    });
  });
}

module.exports = { startServer };
