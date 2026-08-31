# Change contract: Safe seasonal Heroku shutdown and reactivation

## Problem and outcome

- Loser League should not pay for active-season Heroku web compute and expanded
  logging capacity during the off-season.
- Seasonal operations must preserve the live JawsDB database, historical League
  records, reminder settings, push subscriptions, calendar publication state,
  and deployment safety.
- Issue #85 establishes the required behavior. Existing deployment
  documentation establishes that production releases come from the exact tested
  `main` commit through `.github/workflows/test-and-deploy.yml`.

## Scope

- In scope:
  - Owner-run production shutdown and reactivation runbooks.
  - Read-only platform status commands for Heroku formation, add-ons, releases,
    and bounded HTTP health.
  - Read-only database preflight commands for sanitized League Season and
    pending-operation blockers.
  - Documentation for approved seasonal plan transitions and recovery.
- Explicitly out of scope:
  - Migrating away from Heroku.
  - Destroying, deprovisioning, downgrading, or restoring JawsDB.
  - Automatic date-based shutdown, reactivation, or League Season activation.
  - A static/read-only off-season website or calendar-feed fallback.
  - Changing Pick, reminder, calendar, week-closure, or deployment domain
    behavior.
- Affected workflows: production deployment, seasonal shutdown, seasonal
  reactivation, Pick Reminder Settings, calendar feeds, and lifecycle
  coordinators.

## Behavior

- User-visible behavior:
  - Active season runs the production web dyno and capacity-appropriate add-on
    plans.
  - Off-season scales the production `web` formation to zero, downgrades
    Papertrail to the approved free tier, and retains JawsDB on the approved
    paid plan.
  - While the web formation is zero, the website, Pick Reminder Settings, email
    verification and opt-out pages, calendar feeds, and lifecycle coordinators
    are unavailable.
- Acceptance criteria:
  - Shutdown preflight reports exact blocking reasons without sensitive values.
  - Shutdown is blocked when the current League Season is `SETUP` or `ACTIVE`.
  - Shutdown is allowed only when the current League Season is `COMPLETE` or
    `ROLLED_OVER` and no pending operation blockers remain.
  - The operator confirms the resolved production app and each mutation
    immediately before changing Heroku state.
  - The `web` formation reaches zero, Papertrail reaches the approved
    off-season tier, and JawsDB remains attached on its retained paid plan.
  - Reactivation restores the approved active-season Papertrail tier when
    needed, restores the Basic `web` formation, verifies the intended tested
    commit/release, and completes health checks before the next League Season is
    activated.
- Failure and edge cases:
  - Missing or conflicting Heroku app identity blocks mutation.
  - Missing JawsDB blocks both shutdown and reactivation.
  - A JawsDB plan change is never part of this workflow.
  - Heroku config-var names are verified by the owner without retrieving or
    printing secret values.
  - GitHub-to-Heroku deploys can update the Heroku release while the web
    formation is zero; HTTP health checks are expected to fail until the web
    formation is temporarily or permanently restored.
- Invariants that must remain true:
  - No shutdown step deletes database rows, add-on attachments, reminder
    preferences, push subscriptions, calendar state, Users, Tracks, Picks, or
    League history.
  - Production deployment remains exact tested `main` unless a future confirmed
    change contract replaces it.

## Interfaces and data

- Routes, methods, and response bodies: no application route contract changes.
- Pages and browser interactions: no browser UI changes.
- Models, migrations, and stored data: no schema or stored-data changes.
- External systems and consumers:
  - Heroku production app `loser-league`.
  - Heroku `web` process formation.
  - JawsDB add-on attachment and plan.
  - Papertrail add-on attachment and plan.
  - GitHub Actions production deployment workflow.
  - Users and calendar subscribers experience full web unavailability during
    off-season mode.
- Compatibility expectations:
  - Existing deployments, migrations, and rollback rules remain compatible.
  - The new preflight commands are read-only and emit sanitized JSON.

## Design

- Proposed module boundaries and dependency flow:
  - `server/operations/seasonal-heroku-preflight.js` owns sanitized database
    readiness checks and depends on Sequelize models only.
  - `scripts/seasonal-heroku-database-preflight.js` runs the database preflight
    inside the application environment.
  - `scripts/heroku-seasonal-status.js` shells out to the Heroku CLI for
    read-only platform status without reading config vars.
  - Owner-run Heroku mutations remain documented commands with immediate
    confirmation points.
- Considered alternatives:
  - Fully automated shutdown/reactivation was rejected because seasonal
    operations require owner confirmation and provider pricing/plan names must
    be verified at execution time.
  - A static off-season site or calendar feed was rejected for this issue to
    keep the seasonal mode simple and explicit.
  - Automated config-name verification was rejected because Heroku config-var
    APIs expose values; the runbook uses owner dashboard verification instead.
- Decisions still requiring an ADR: none.

## Safety and delivery

- Authentication and authorization:
  - Only the production owner with Heroku and GitHub production access may
    authorize shutdown or reactivation.
  - Each production mutation requires immediate owner approval for the exact app
    and target plan/formation.
- Input, secret, and personal-data handling:
  - Commands must not print or retrieve config values, database URLs,
    credentials, sessions, request bodies, User data, Pick details, or
    production records.
  - Preflight output is limited to states, counts, timestamps, release
    identities, plan names, and blocking categories.
- Migration and rollout:
  - Merge through the existing pull-request and tested-main deployment path.
  - Observe the first production run before using seasonal operations.
- Rollback or recovery:
  - Partial shutdown: restore `web` Basic formation and the prior Papertrail
    tier, then rerun status and health checks.
  - Partial reactivation: keep the next League Season inactive until formation,
    release, migrations, database connectivity, health checks, and coordinators
    are verified.
  - Failed release, migration, or health check follows `docs/operations/heroku-deploy.md`.
- Observability:
  - Record sanitized preflight/status output, exact app name, formation,
    add-on plan names, Heroku release, GitHub SHA, and health-check result.

## Verification

- Regression or characterization test:
  - Unit tests cover shutdown blocking for `SETUP`/`ACTIVE`, allowance for
    `COMPLETE`/`ROLLED_OVER`, pending-operation blockers, sanitized summary
    shape, and local Heroku command construction.
- Unit tests:
  - `npm run test:unit -- test/unit/seasonal-heroku-preflight.test.js`
  - `npm run test:unit -- test/unit/heroku-seasonal-status.test.js`
- Integration tests and disposable database:
  - Full repository PR gate remains required before pull request publication.
- Browser smoke tests:
  - Full smoke gate remains required before pull request publication.
- Manual or live-data checks:
  - Owner-supervised first shutdown and reactivation record sanitized
    preflight/status results only.

## Decisions and open questions

- Resolved decisions:
  - Only the production owner authorizes shutdown and reactivation.
  - Shutdown is permitted only for `COMPLETE` or `ROLLED_OVER`; `SETUP` and
    `ACTIVE` block shutdown.
  - Off-season web unavailability includes calendar feeds and reminder pages.
  - Preserve the tested-main GitHub-to-Heroku deployment contract during
    hibernation.
- Open questions: none.
- Owners or external dependencies: production owner, GitHub, Heroku, JawsDB,
  Papertrail.

## Completion

- Documentation to update:
  - `docs/operations/heroku-deploy.md`.
  - `docs/operations/papertrail-log-volume.md` only if active-season measured
    capacity changes the selected plan.
- Residual risks:
  - Provider plan names, prices, and quotas can change and must be checked at
    execution time.
  - A zero web formation makes ordinary HTTP health checks unavailable until
    reactivation.
  - Heroku config-var name verification remains a manual owner dashboard check
    to avoid retrieving secret values.
- Next safe step:
  - Implement the read-only commands, update the runbook, complete local tests,
    then run every repository PR gate before publishing a pull request.
