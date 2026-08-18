const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.join(__dirname, "../..");

test("Heroku release migrations retain their production runner", () => {
  const packageJson = require("../../package.json");

  assert.equal(packageJson.dependencies["sequelize-cli"], "^6.6.1");
  assert.equal(packageJson.devDependencies?.["sequelize-cli"], undefined);
});

test("deployment verifies the new Heroku release before HTTP health", () => {
  const workflow = fs.readFileSync(
    path.join(repositoryRoot, ".github/workflows/test-and-deploy.yml"),
    "utf8"
  );
  const captureIndex = workflow.indexOf("Capture current Heroku release");
  const deployIndex = workflow.indexOf("      - name: Deploy tested commit");
  const releaseIndex = workflow.indexOf("Verify Heroku release succeeded");
  const healthIndex = workflow.indexOf("Verify production health");

  assert.ok(captureIndex > -1, "workflow must capture the current release");
  assert.ok(deployIndex > captureIndex, "deployment must follow release capture");
  assert.ok(releaseIndex > deployIndex, "release verification must follow deployment");
  assert.ok(healthIndex > releaseIndex, "health checks must follow release verification");
  assert.match(workflow, /release status is \$release_status, expected succeeded/);
});

test("deployment reruns verify an already-deployed successful SHA", () => {
  const workflow = fs.readFileSync(
    path.join(repositoryRoot, ".github/workflows/test-and-deploy.yml"),
    "utf8"
  );

  assert.match(workflow, /git ls-remote heroku refs\/heads\/main/);
  assert.match(workflow, /already_deployed=true/);
  assert.match(
    workflow,
    /if: .*steps\.prior_release\.outputs\.already_deployed != 'true'/
  );
  assert.match(workflow, /Deploy \$\{GITHUB_SHA:0:8\}/);
  assert.match(workflow, /Existing Heroku release .* is succeeded/);
});

test("deployment attempts one bounded web recovery for an isolated NFL health failure", () => {
  const workflow = fs.readFileSync(
    path.join(repositoryRoot, ".github/workflows/test-and-deploy.yml"),
    "utf8"
  );

  assert.match(workflow, /check_health "\/"/);
  assert.match(workflow, /check_health "\/api\/nfl\/teams"/);
  assert.match(workflow, /Upstream health check failed; restarting the web process type once/);
  assert.match(workflow, /heroku ps:restart --process-type web --app "\$HEROKU_APP_NAME"/);
  assert.match(workflow, /Production health recovered after one web process restart/);
  assert.equal(
    workflow.match(/heroku ps:restart --process-type web/g)?.length,
    1,
    "workflow must not introduce a restart loop"
  );
});
