function parseBootstrapArguments(args) {
  const values = {};
  let apply = false;
  const weekOneBuybackTrackIds = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--apply") {
      apply = true;
      continue;
    }
    if (argument === "--week-one-buyback-track") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--week-one-buyback-track requires a value");
      }
      weekOneBuybackTrackIds.push(Number(value));
      index += 1;
      continue;
    }
    if (!new Set(["--year", "--state", "--week"]).has(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    if (values[argument] !== undefined) {
      throw new Error(`Duplicate argument: ${argument}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value`);
    }
    values[argument] = value;
    index += 1;
  }

  for (const required of ["--year", "--state", "--week"]) {
    if (values[required] === undefined) {
      throw new Error(`${required} is required`);
    }
  }

  const parsed = {
    year: Number(values["--year"]),
    state: values["--state"],
    week: Number(values["--week"]),
    apply,
  };
  if (weekOneBuybackTrackIds.length > 0) {
    parsed.weekOneBuybackTrackIds = weekOneBuybackTrackIds;
  }
  return parsed;
}

async function main() {
  const sequelize = require("../config/connection");
  const {
    bootstrapLeagueSeason,
  } = require("../server/modules/league-season/bootstrap");

  try {
    const options = parseBootstrapArguments(process.argv.slice(2));
    const summary = await bootstrapLeagueSeason(options);
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  } catch (error) {
    process.stderr.write(`League Season bootstrap failed: ${error.message}\n`);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = { parseBootstrapArguments };
