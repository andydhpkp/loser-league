# Change contract: Fail closed on Heroku release commands

## Problem and outcome

- Main commit `605fb6b` produced Heroku release `v257`, whose release command
  failed because `sequelize-cli` was pruned as a development dependency.
- The GitHub deployment job still reported success because the Heroku Git push
  exited successfully and health checks reached the prior healthy release.
- Production must contain the migration runner, and deployment must fail before
  health checks unless the new release completed successfully.

## Scope

- In scope: make `sequelize-cli` a production dependency; capture the release
  created by the push; verify that exact release reached `succeeded`; document
  the recovered deployment gate.
- Explicitly out of scope: manual migration or bootstrap, rollback, dependency
  upgrades, application behavior, and #12A.
- Affected workflow: GitHub-to-Heroku deployment only. Users, Tracks, Picks, and
  League Seasons are unchanged.

## Behavior

- The Heroku release phase can execute `npm run db:migrate` after development
  dependencies are pruned.
- The deploy job resolves the release created for `GITHUB_SHA`, waits for its
  status, and fails unless it is `succeeded` before checking HTTP health.
- A failed or unresolvable release never receives a false-green result from the
  prior production version.

## Interfaces and data

- No HTTP, page, model, migration, or stored-data contract changes.
- `package.json`, `package-lock.json`, and
  `.github/workflows/test-and-deploy.yml` are affected.
- Heroku and GitHub Actions remain the only external consumers.

## Design

- Keep migration execution in the existing Heroku release process.
- Use the official Heroku CLI to inspect release version, status, and commit
  metadata without retrieving config or production data.
- Do not rely on Git push exit status or HTTP health as proof that a release
  command succeeded.

## Safety and delivery

- Existing Heroku/GitHub authentication and secret handling remain unchanged.
- Recovery is a forward-fix PR. The prior production release remains active
  because `v257` failed.
- If the repair release fails, the workflow fails closed and production remains
  on its last successful release.

## Verification

- Add a regression test that requires `sequelize-cli` in production
  dependencies and requires release-status verification before health checks.
- Run the complete repository PR gate, including disposable-MySQL migrations.
- After merge, confirm the exact tested SHA, successful Heroku release phase,
  release identifier, and both production health checks.

## Decisions and open questions

- Resolved: ship both the missing runtime dependency and false-green workflow
  fix together because they are two observed causes of the same failed gate.
- Open questions: none.

## Completion

- Update deployment operations and the lifecycle program status.
- Verification on 2026-08-01:
  - `npm run test:unit` — passed, 81 tests.
  - `npm run test:unit:coverage` — passed, 86.77% line coverage.
  - `npm run lint:browser` — passed.
  - `npm run test:integration` — passed, 8 tests against disposable MySQL.
  - `npm run test:smoke` — passed, 7 Playwright tests.
  - production-only dependency inspection found `sequelize-cli@6.6.1`.
  - workflow YAML parsed successfully.
- Residual risk: Heroku release metadata can be delayed briefly, so lookup and
  status checks require bounded retries.
- Next safe step: merge, verify the recovered deployment, then perform only the
  documented League Season bootstrap dry-run.
