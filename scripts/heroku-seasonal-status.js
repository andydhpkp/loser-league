const { spawnSync } = require("node:child_process");

function parseArguments(args) {
  const values = { app: null, origin: null };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!["--app", "--origin"].includes(argument)) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value`);
    }
    values[argument.slice(2)] = value;
    index += 1;
  }
  if (!values.app) throw new Error("--app is required");
  if (!/^[a-z][a-z0-9-]*$/.test(values.app)) {
    throw new Error("--app must be an exact Heroku app name");
  }
  return values;
}

function runJson(command, args, { spawn = spawnSync } = {}) {
  const result = spawn(command, args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
  return JSON.parse(result.stdout || "null");
}

function runText(command, args, { spawn = spawnSync } = {}) {
  const result = spawn(command, args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
  return result.stdout;
}

function summarizeFormation(processes) {
  return (Array.isArray(processes) ? processes : [])
    .map((item) => ({
      type: item.type,
      dynos: item.quantity ?? item.dynos ?? 0,
      size: typeof item.size === "string" ? item.size : item.size?.name || null,
    }))
    .sort((left, right) => left.type.localeCompare(right.type));
}

function summarizeAddons(addons) {
  return (Array.isArray(addons) ? addons : [])
    .map((addon) => ({
      name: addon.name,
      service: addon.addon_service?.name || addon.plan?.addon_service?.name || null,
      plan: addon.plan?.name || null,
      state: addon.state || null,
    }))
    .sort((left, right) => String(left.name).localeCompare(String(right.name)));
}

function latestRelease(releases) {
  const release = Array.isArray(releases) ? releases[0] : null;
  if (!release) return null;
  return {
    version: release.version,
    status: release.status,
    description: release.description,
    createdAt: release.created_at,
  };
}

async function checkHealth(origin, fetchImpl = global.fetch) {
  if (!origin) return { configured: false };
  const checks = [];
  for (const path of ["/", "/api/nfl/teams"]) {
    try {
      const response = await fetchImpl(new URL(path, origin));
      checks.push({ path, status: response.status, ok: response.ok });
    } catch (error) {
      checks.push({ path, ok: false, errorType: error.name });
    }
  }
  return { configured: true, checks };
}

async function buildStatus({ app, origin, spawn = spawnSync, fetchImpl = global.fetch }) {
  const [formation, addons, releases] = [
    runJson("heroku", ["api", `/apps/${app}/formation`], { spawn }),
    runJson("heroku", ["addons", "--json", "--app", app], { spawn }),
    runJson("heroku", ["releases", "--json", "--app", app], { spawn }),
  ];

  return {
    app,
    checkedAt: new Date().toISOString(),
    formation: summarizeFormation(formation),
    addons: summarizeAddons(addons),
    latestRelease: latestRelease(releases),
    gitRemoteMain: runText("git", ["ls-remote", "heroku", "refs/heads/main"], {
      spawn,
    }).trim(),
    health: await checkHealth(origin, fetchImpl),
    configValuesRead: false,
  };
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    const status = await buildStatus(options);
    process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Heroku seasonal status failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}

module.exports = {
  buildStatus,
  checkHealth,
  latestRelease,
  parseArguments,
  summarizeAddons,
  summarizeFormation,
};
