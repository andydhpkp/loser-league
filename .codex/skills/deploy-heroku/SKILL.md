---
name: deploy-heroku
description: Operate the Loser League GitHub-to-Heroku production deployment. Use when configuring, inspecting, verifying, troubleshooting, rotating credentials for, or rolling back the repository's automatic Heroku deployment after changes reach main.
---

# Deploy Heroku

Treat `.github/workflows/test-and-deploy.yml` as the routine deployment
mechanism. Do not manually deploy a feature branch or an untested commit.

## Establish state

1. Read `AGENTS.md`, `docs/engineering/README.md`,
   `docs/plans/heroku-auto-deploy.md`, and `docs/operations/heroku-deploy.md`.
2. Inspect the current branch, worktree, target commit, GitHub workflow run, and
   Heroku release before proposing a mutation.
3. Distinguish a CI failure, Heroku build failure, release failure, and
   post-deploy health-check failure.
4. Never print or retrieve secret values, Heroku config values, database URLs,
   sessions, request bodies, or production data.

## Routine deployment

- Let a push to `main` trigger the workflow automatically.
- Require the unit suite, coverage gate, browser lint, disposable-MySQL
  integration suite, and browser smoke suite to pass without skips.
- Confirm the deploy job uses the same GitHub SHA tested by the validation job.
- Confirm the production environment and serialized deployment concurrency are
  active.
- Confirm both bounded production health checks pass.
- Report the GitHub SHA, workflow run, Heroku release, and health-check result;
  do not report credentials or configuration values.

## Diagnose a failed deployment

1. Read the failed GitHub job and step before touching Heroku.
2. For test failures, reproduce locally with the documented disposable test
   database and fix through a pull request.
3. For build or release failures, inspect only the relevant Heroku build and
   release status/log events. Redact sensitive values.
4. For health-check failures, verify the deployed release SHA, dyno state, and
   safe application logs. Do not use live database writes as a diagnostic.
5. Prefer a forward fix when production is stable on the prior release.

## Roll back

Treat rollback as a destructive production mutation.

1. List recent releases without exposing config changes or secret values.
2. Identify the exact known-good release and explain any migration or data
   compatibility risk.
3. Obtain explicit user approval for that release number.
4. Run the scoped Heroku rollback for the `loser-league` app.
5. Re-run the homepage and `/api/nfl/teams` health checks and report the new
   release state.

Never select a release by relative guesswork such as “the previous one” without
resolving its exact identifier first. Never automate rollback in the workflow.

## Configure or rotate credentials

- Use a dedicated Heroku automation authorization when supported.
- Store it only as the `HEROKU_API_KEY` secret in GitHub's `production`
  environment.
- Store `HEROKU_APP_NAME=loser-league` as a non-secret environment variable.
- Verify only that the expected names exist; never read secret values back.
- Revoke superseded Heroku authorizations after the replacement workflow has
  succeeded.

## Change the workflow

- Use a grill-style change contract before changing triggers, gates,
  credentials, environments, deployment targets, migrations, health checks,
  or rollback behavior.
- Keep pull-request jobs free of production secrets.
- Use official GitHub and Heroku tooling; pin external tooling versions where
  practical.
- Run every repository PR gate and validate workflow syntax before publishing.
- Update the plan and operations document with any contract change.
