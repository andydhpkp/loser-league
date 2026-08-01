async function startServer({ app, database, port, logger, lifecycleCoordinator }) {
  await database.authenticate();

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      logger.info("server_started", { port });
      lifecycleCoordinator?.start();
      queueMicrotask(() => resolve(server));
    });
  });
}

module.exports = { startServer };
