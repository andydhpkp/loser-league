function assertDisposableTestDatabase(databaseUrl) {
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid MySQL URL");
  }

  if (!["mysql:", "mariadb:"].includes(parsed.protocol)) {
    throw new Error("TEST_DATABASE_URL must be a valid MySQL URL");
  }

  const databaseName = parsed.pathname.replace(/^\/+/, "");
  if (!databaseName.toLowerCase().includes("test")) {
    throw new Error(
      'TEST_DATABASE_URL database name must contain "test"'
    );
  }

  return parsed;
}

module.exports = { assertDisposableTestDatabase };
