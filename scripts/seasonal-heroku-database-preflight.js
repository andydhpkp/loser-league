async function main() {
  const sequelize = require("../config/connection");
  const models = require("../models/my-index");
  const {
    buildSeasonalDatabasePreflight,
  } = require("../server/operations/seasonal-heroku-preflight");

  try {
    const mode = parseMode(process.argv.slice(2));
    const summary = await buildSeasonalDatabasePreflight({
      models: { ...models, sequelize },
      mode,
    });
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    if (mode === "shutdown" && !summary.shutdown.allowed) {
      process.exitCode = 2;
    }
  } catch (error) {
    process.stderr.write(`Seasonal Heroku database preflight failed: ${error.message}\n`);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

function parseMode(args) {
  if (args.length === 0) return "shutdown";
  if (args.length === 2 && args[0] === "--mode") {
    if (["shutdown", "reactivation"].includes(args[1])) return args[1];
    throw new Error("--mode must be shutdown or reactivation");
  }
  throw new Error("Usage: npm run heroku:seasonal:database-preflight -- --mode shutdown");
}

if (require.main === module) {
  main();
}

module.exports = { parseMode };
