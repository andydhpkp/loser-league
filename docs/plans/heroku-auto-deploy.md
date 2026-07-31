# Change contract: Deploy tested main commits to Heroku

## Problem and outcome

- Production deployment currently requires a separate manual Heroku push after
  a pull request merges.
- Automatically test every proposed and merged change, then deploy the exact
  tested `main` commit to the existing `loser-league` Heroku app.
- Provide a project-specific Codex skill for setup, diagnosis, verification,
  and guided rollback.

## Scope

- In scope:
  - GitHub Actions validation for pull requests targeting `main`.
  - Fresh validation and automatic Heroku deployment for pushes to `main`.
  - A disposable MySQL CI service and Playwright browser installation.
  - Serialized production deployments.
  - Bounded post-deploy health checks.
  - A repository-owned Heroku deployment skill and operations documentation.
  - A GitHub `production` environment containing scoped deployment settings.
- Explicitly out of scope:
  - Deploying pull-request branches to production.
  - Automatic rollback.
  - Changing Heroku application configuration or production database data.
  - Review apps, staging apps, Heroku Pipelines, or schema migrations.
- Affected workflow: pull-request validation, merge-to-production deployment,
  incident diagnosis, and rollback.

## Behavior

- Pull requests targeting `main` run every required repository check and never
  receive production credentials.
- Every push to `main` reruns the complete gate against that exact commit.
- Deployment starts only when every check passes without skips.
- The tested commit is pushed to the Heroku Git remote's `main` branch.
- Deployments are serialized, and a queued run must revalidate that its tested
  SHA is still current `main`, so rapid merges cannot release stale code.
- After deployment, the workflow polls the production homepage and
  `/api/nfl/teams` with bounded retries.
- A failed health check fails the workflow and requires guided diagnosis or
  explicit rollback; it does not trigger a blind automatic rollback.

## Interfaces and data

- Workflow: `.github/workflows/test-and-deploy.yml`.
- Project skill: `.codex/skills/deploy-heroku/`.
- GitHub environment: `production`.
- Environment secret: `HEROKU_API_KEY`.
- Environment variable: `HEROKU_APP_NAME=loser-league`.
- CI database credentials are disposable test-only values. The schema name
  contains `test` and is never shared with development or production.
- No application route, response, model, migration, or stored production data
  changes.

## Design

- Use GitHub-hosted Ubuntu runners and a MySQL service container.
- Use the repository's Node 22 contract and npm lockfile.
- Install Playwright Chromium before browser smoke tests.
- Install and use the official Heroku CLI; do not use a third-party deployment
  action.
- Authenticate only through the scoped GitHub environment secret.
- Use GitHub Actions concurrency for ordered production deployment.

## Safety and delivery

- Grant the workflow read-only repository contents permission.
- Do not echo, persist, or commit the Heroku credential.
- Do not expose the production environment to pull-request jobs.
- The `production` environment has no required reviewer so deployment remains
  automatic after a successful merge.
- Create a dedicated Heroku automation authorization rather than copying a
  personal credential when supported.
- Manual rollback requires inspecting releases and confirming the exact target
  release before mutation.

## Verification

- Validate workflow YAML structure and action references.
- Validate the project skill with skill-creator's `quick_validate.py`.
- Run the complete local repository gate.
- Confirm the GitHub environment contains the expected variable and secret
  name without retrieving or printing the secret value.
- After merge, confirm the workflow tests, deploys, and reports successful
  production health checks for the exact `main` SHA.

## Decisions and open questions

- Resolved decisions:
  - Use GitHub Actions rather than a manually invoked skill as the event
    trigger.
  - Use Heroku Git through the official CLI.
  - Validate PRs and retest merged commits.
  - Serialize production deployments.
  - Use scoped GitHub environment settings without a manual reviewer.
  - Use health checks with guided manual rollback.
- Open questions: None.
- External dependencies: GitHub Actions, GitHub Environments, Heroku Git, and
  the existing production app.

## Completion

- Update deployment and operations documentation.
- Residual risks:
  - GitHub, Heroku, npm, MySQL image, or Playwright download outages can delay
    deployment while leaving the previous release running.
  - A health endpoint can succeed without exercising every application path.
- Next safe step: merge the deployment PR, observe its first `main` run, verify
  the resulting Heroku release, and retain explicit rollback authority.
