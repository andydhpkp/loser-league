# Change contract: Make Heroku deploy reruns idempotent

## Problem and outcome

- Rerunning GitHub Actions job `94967028194` for commit `cf481dc5` pushed an
  already-deployed SHA, so Heroku correctly created no new release.
- The workflow nevertheless required a release version different from the
  captured prior version and failed after reporting that the unchanged release
  status was `succeeded`.
- Rerunning a successfully deployed commit must verify that existing release
  instead of requiring a redundant Heroku release.

## Scope

- In scope: detect an exact SHA already present on the Heroku Git `main` ref,
  skip its redundant push, verify its matching successful deploy release, and
  retain both production health checks.
- Explicitly out of scope: application behavior, Heroku configuration,
  migrations, rollback, health-check policy, dependency upgrades, and manual
  deployment of untested commits.
- Affected workflow: GitHub-to-Heroku deployment reruns only. Users, Tracks,
  Picks, and League Seasons are unchanged.

## Behavior

- A first deployment still requires a newly created Heroku release to reach
  `succeeded` before HTTP health checks run.
- A rerun may reuse an existing release only when the Heroku Git `main` ref
  equals the exact tested `GITHUB_SHA` and the matching deploy release has
  status `succeeded`.
- A missing, failed, or unresolvable matching release fails closed.
- Homepage and `/api/nfl/teams` health checks run for both first deployments
  and idempotent reruns.

## Interfaces and data

- `.github/workflows/test-and-deploy.yml` and its deployment contract test are
  affected.
- No HTTP, page, model, migration, stored-data, or secret contract changes.
- GitHub Actions and Heroku Git/release metadata remain the external systems.

## Design

- Resolve the remote Heroku `main` SHA before deployment.
- When it equals `GITHUB_SHA`, skip `git push` and locate the matching `Deploy
  <short-sha>` release in the existing safe `heroku releases --json` metadata.
- Otherwise preserve the current prior-release capture, push, and bounded
  new-release status loop.
- No ADR is required; this repairs the documented deployment contract without
  changing architecture.

## Safety and delivery

- Existing authentication and authorization remain unchanged.
- Do not inspect or print Heroku config, secrets, production data, or request
  bodies.
- Rollback is reverting this workflow change; no production data migration is
  involved.
- The workflow emits whether it is deploying or verifying an existing SHA and
  retains bounded failure messages.

## Verification

- Extend the deployment contract test to require exact remote-SHA detection,
  conditional push behavior, matching existing-release verification, and
  health checks after release verification.
- Run the unit suite and parse the workflow YAML.
- Before a pull request, run every required repository gate documented in
  `docs/engineering/README.md`.
- After merge, rerun a successful deployment job and confirm it verifies the
  existing release plus both production health checks.

## Decisions and open questions

- Resolved: an already-deployed successful SHA is valid and proceeds to health
  checks without creating a redundant release.
- Open questions: none.
- External dependencies: GitHub Actions and Heroku release/Git metadata.

## Completion

- Update deployment operations documentation alongside the workflow.
- Residual risk: Heroku's deploy-release description contains its conventional
  eight-character commit prefix; the exact Git ref comparison remains the
  primary identity check.
- Next safe step: publish through the normal reviewed pull-request workflow,
  then rerun the deployment job as the live idempotency check.
