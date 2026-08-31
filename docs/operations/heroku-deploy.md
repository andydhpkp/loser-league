# Heroku deployment operations

> Pick Reminders owner setup is deferred. Before any beta, configure the exact HTTPS canonical origin; push/VAPID settings; and the dedicated Gmail sender, app password, credential version, and versioned email token key. Keep system, email, push, and public release controls off until the full launch checklist passes. Never place real values in source or deployment transcripts.

PR 6 adds the integrated UI and fail-closed readiness gate but authorizes no Heroku changes. Follow the complete owner setup, controlled-beta, monitoring, rotation, incident, rollback, and launch checklist in [`pick-reminders.md`](pick-reminders.md). Readiness never enables public release automatically.

Loser League deploys the exact tested `main` commit through
`.github/workflows/test-and-deploy.yml`.

Papertrail ingestion measurement, budgets, filter canaries, and recovery are
documented in [`papertrail-log-volume.md`](papertrail-log-volume.md). Production
filter, alert, and plan mutations always require explicit owner approval.

Seasonal shutdown and reactivation are owner-run production operations. They
can reduce off-season cost, but they intentionally make the web application
unavailable while preserving the database and League history. Follow
[`#seasonal-shutdown`](#seasonal-shutdown) and
[`#seasonal-reactivation`](#seasonal-reactivation); never improvise a JawsDB
deprovisioning workflow.

## GitHub configuration

Create a GitHub Environment named `production` with no required reviewer:

- Secret: `HEROKU_API_KEY`, containing a dedicated Heroku automation token.
- Variable: `HEROKU_APP_NAME`, set to `loser-league`.

The initial automation authorization expires after one year. Rotate it before
expiration so an otherwise healthy merge is not blocked at deployment time.

Pull-request validation cannot access this environment. Only the deploy job for
a successful push to `main` requests it.

## Application configuration

The Heroku app requires an `ADMIN_PASSWORD` config key for the shared admin
login. Set or rotate its value through authorized Heroku configuration access
before merging a release that introduces or changes admin authentication.
Never place the value in source, a pull request, a command transcript, logs, or
operations documentation, and never retrieve it during deployment verification.

Zero-Track onboarding also uses `ONBOARDING_TATE_PHONE`,
`ONBOARDING_ANDREW_PHONE`, `ONBOARDING_VENMO_HANDLE`, and
`ONBOARDING_VENMO_URL`. Set their values directly through authorized Heroku
configuration. Verify only that the key names exist; never retrieve or print
phone values. Invalid or absent values degrade to valid remaining actions or a
safe generic fallback rather than preventing startup. See
[`zero-track-onboarding.md`](zero-track-onboarding.md).

Pick Reminders PR 1 recognizes `PICK_REMINDERS_SYSTEM_AVAILABLE` as a strict
boolean string. Missing, invalid, or `false` values fail closed. Do not set it
to `true` during PR 1 deployment; owner configuration and production
enablement are deferred until the complete reminder program is launch-ready.

PR 2 also recognizes `PICK_REMINDERS_EMAIL_DELIVERY_AVAILABLE`,
`PICK_REMINDERS_PUSH_DELIVERY_AVAILABLE`, and
`PICK_REMINDERS_ADMIN_CAMPAIGN_AVAILABLE`. Leave them absent/off. Do not add
provider credentials or enable public release during the foundation rollout.

PR 4 recognizes `PICK_REMINDERS_EMAIL_FROM`, `PICK_REMINDERS_EMAIL_REPLY_TO`,
`PICK_REMINDERS_GMAIL_USER`, `PICK_REMINDERS_GMAIL_APP_PASSWORD`,
`PICK_REMINDERS_GMAIL_CREDENTIAL_VERSION`, `PICK_REMINDERS_EMAIL_TOKEN_KEY`,
`PICK_REMINDERS_EMAIL_TOKEN_KEY_VERSION`, and the optional prior token
key/version pair. Owner setup is required later; leave all absent and keep
`PICK_REMINDERS_EMAIL_DELIVERY_AVAILABLE` off. Breaker recovery requires a
repaired app password and deliberate credential-version change.

Verify only that the key name is present. Missing configuration prevents the
application from starting, which intentionally blocks deployment rather than
publishing an admin interface with a fallback credential.

## Deployment sequence

1. A pull request targeting `main` runs unit tests, the coverage gate, browser
   lint, disposable-MySQL integration tests, and browser smoke tests.
2. After merge, the push to `main` reruns that complete gate against the merge
   commit.
3. The serialized deploy job verifies that the tested SHA is still current
   `main`; stale queued runs exit without deploying.
4. The job compares the tested SHA with the Heroku Git `main` ref. A rerun of
   an already-deployed SHA skips the redundant push and verifies that SHA's
   existing successful deploy release. Otherwise, the job records the current
   Heroku release and pushes that exact SHA to Heroku Git.
5. Heroku runs the `release` command, applying reviewed forward migrations
   before activating a new web release. An idempotent rerun creates no release
   and therefore runs no duplicate migration command. A migration failure
   blocks release.
6. The workflow verifies that a new Heroku release reached `succeeded`, or
   that an idempotent rerun's exact existing deploy release succeeded; Git push
   success and health from a different release are not sufficient.
7. The web process verifies database connectivity without synchronizing schema.
8. The workflow polls the production homepage and `/api/nfl/teams`.
9. If the homepage is healthy but the NFL Teams check exhausts its retries,
   the workflow records an upstream-health failure, restarts the `web` process
   type once, and repeats both bounded checks. It records recovery when both
   pass; otherwise it fails without another restart or rollback.

League Season foundation deployments require the separate explicit bootstrap
documented in [`league-season-bootstrap.md`](league-season-bootstrap.md).
Migrations intentionally do not infer or populate production lifecycle state.

A failed test prevents deployment. A failed Heroku build or release leaves the
prior release active and fails the workflow before HTTP health checks. A failed
homepage check does not trigger recovery. An isolated ESPN health failure gets
one bounded `web` process restart; persistent failure marks the workflow failed
without an automatic rollback.

## Verification

For each deployment, record:

- GitHub workflow run and tested commit SHA;
- Heroku release identifier and deployed commit;
- successful release-phase migration result without configuration values;
- homepage and NFL Teams health-check results.

Do not record Heroku configuration values, credentials, database URLs, request
bodies, sessions, or production data.

## Seasonal operations

Use seasonal operations only after the production owner confirms the exact
target app and the current provider plan names/prices. Prices and add-on tier
names are planning inputs, not source-controlled constants.

Authorized production operator: the production owner with Heroku and GitHub
production access. A helper can prepare status output, but only the production
owner can approve shutdown, reactivation, Papertrail plan changes, dyno
formation changes, rollback, or recovery mutations.

Approved seasonal states:

- Active season:
  - Heroku `web` formation runs on the approved Basic-size formation.
  - JawsDB stays on the capacity-appropriate paid plan.
  - Papertrail uses the smallest currently available tier that satisfies the
    active-season volume model in [`papertrail-log-volume.md`](papertrail-log-volume.md).
- Off-season:
  - Heroku `web` formation is scaled to zero.
  - JawsDB stays attached on the approved paid plan. Do not deprovision,
    downgrade, destroy, detach, or restore JawsDB as part of seasonal shutdown.
  - Papertrail is downgraded to the approved free tier after current plan names,
    quotas, retention, and prices are verified.

While the `web` formation is zero:

- the website is unavailable;
- Pick Reminder Settings are unavailable;
- email verification and opt-out pages are unavailable;
- calendar feeds are unavailable;
- reminder, auto-pick, calendar, and week-closure coordinators do not run; and
- production HTTP health checks cannot pass until `web` is scaled back up.

The GitHub-to-Heroku deployment contract remains unchanged during hibernation.
Merges to `main` still run the complete gate and push the exact tested commit
to Heroku. The release phase can run while the `web` formation is zero, but
HTTP health checks are expected to fail unless the owner temporarily restores a
web dyno for verification. Reactivation must verify the intended tested commit
or deploy a new tested commit before the next League Season is activated.

### Read-only seasonal status

Run local Heroku status from a trusted checkout with the Heroku CLI
authenticated to the production owner:

```sh
npm run heroku:seasonal:status -- --app loser-league --origin https://loser-league.herokuapp.com
```

This command reads process formation, add-on names and plan names, the latest
release, the Heroku Git `main` ref, and bounded HTTP health. It does not call
Heroku config-var commands and does not read configuration values.

Run the database preflight inside a Heroku one-off dyno so it uses production
configuration without printing configuration values:

```sh
heroku run --app loser-league --no-tty "npm run heroku:seasonal:database-preflight -- --mode shutdown"
```

For reactivation:

```sh
heroku run --app loser-league --no-tty "npm run heroku:seasonal:database-preflight -- --mode reactivation"
```

The database preflight reports only database reachability, sanitized League
Season state, aggregate pending-operation counts, and blocking categories. It
exits non-zero for a blocked shutdown. It must not print User data, Track data,
Pick details, request bodies, sessions, database URLs, credentials, or
configuration values.

Do not automate Heroku config-var verification through CLI or API calls because
Heroku returns values with config-var reads. During reactivation, the production
owner verifies required config-var names in the Heroku dashboard without
copying values into chat, issues, logs, or documents.

### Seasonal shutdown

Shutdown is permitted only when the current League Season is `COMPLETE` or
`ROLLED_OVER`, and no pending deadline, delivery, closure, migration, release,
or admin-confirmation operation remains. Shutdown is blocked when the current
League Season is `SETUP` or `ACTIVE`.

1. Confirm there is no release currently running and no pull request is about
   to merge to `main`.
2. Run read-only seasonal status:

   ```sh
   npm run heroku:seasonal:status -- --app loser-league --origin https://loser-league.herokuapp.com
   ```

3. Run the production database preflight:

   ```sh
   heroku run --app loser-league --no-tty "npm run heroku:seasonal:database-preflight -- --mode shutdown"
   ```

4. Verify the preflight result:
   - `shutdown.allowed` is `true`;
   - current League Season state is `COMPLETE` or `ROLLED_OVER`;
   - pending admin previews, reminder deliveries, and push device deliveries
     are zero;
   - JawsDB is attached and on the approved retained paid plan;
   - Papertrail's current plan and free-tier target have been checked against
     current provider pricing and retention.
5. Owner confirmation: state the exact Heroku app name, current and target
   Papertrail plan names, current JawsDB plan name, and the target web
   formation of zero. Stop unless the production owner approves those exact
   values immediately before mutation.
6. Downgrade only Papertrail to the approved free tier:

   ```sh
   heroku addons:upgrade <papertrail-free-plan-name> --app loser-league
   ```

7. Scale only the web process type to zero:

   ```sh
   heroku ps:scale web=0 --app loser-league
   ```

8. Re-run seasonal status without expecting HTTP health to pass:

   ```sh
   npm run heroku:seasonal:status -- --app loser-league --origin https://loser-league.herokuapp.com
   ```

9. Record the sanitized status output, formation, add-on plan names, latest
   release identifier, Heroku Git `main` ref, shutdown approver, date, and any
   expected unavailable health checks.

Shutdown must not run:

- `heroku addons:destroy`;
- `heroku addons:detach`;
- any JawsDB plan mutation;
- any database write or cleanup command;
- any command that prints config vars, database URLs, credentials, sessions,
  request bodies, User data, Track data, Pick details, or production records.

### Seasonal reactivation

Reactivation restores production capacity and proves readiness before the next
League Season is activated. Do not start a new League Season until every
reactivation verification item has passed.

1. Verify current Heroku and provider pricing, plan names, quotas, and
   retention. Choose the smallest active-season Papertrail plan that satisfies
   [`papertrail-log-volume.md`](papertrail-log-volume.md).
2. Check the intended release:
   - identify the exact tested GitHub SHA intended for production;
   - confirm the matching GitHub Actions run passed every required gate; and
   - deploy or verify that exact commit through the existing tested-main
     workflow.
3. Run read-only seasonal status:

   ```sh
   npm run heroku:seasonal:status -- --app loser-league --origin https://loser-league.herokuapp.com
   ```

4. Owner dashboard check: verify required config-var names exist without
   copying or reading values into a transcript. At minimum, confirm the names
   documented in the application configuration section of this runbook and the
   reminder/calendar operations runbooks for any enabled feature controls.
5. Owner confirmation: state the exact Heroku app name, current and target
   Papertrail plan names, current JawsDB plan name, target web formation, and
   intended tested commit/release. Stop unless the production owner approves
   those exact values immediately before mutation.
6. Upgrade Papertrail to the approved active-season tier when needed:

   ```sh
   heroku addons:upgrade <papertrail-active-season-plan-name> --app loser-league
   ```

7. Restore the web process type:

   ```sh
   heroku ps:scale web=1:Basic --app loser-league
   ```

8. Confirm release-phase migrations are current without printing config:

   ```sh
   heroku run --app loser-league --no-tty "npm run db:migrate"
   ```

9. Run the production database reactivation preflight:

   ```sh
   heroku run --app loser-league --no-tty "npm run heroku:seasonal:database-preflight -- --mode reactivation"
   ```

10. Run seasonal status and require both HTTP health checks to pass:

    ```sh
    npm run heroku:seasonal:status -- --app loser-league --origin https://loser-league.herokuapp.com
    ```

11. Verify coordinator readiness by inspecting sanitized startup and readiness
    events only:
    - database connectivity succeeded;
    - auto-pick coordinator is not blocked;
    - week-closure coordinator is not blocked;
    - reminder coordinator startup/catch-up completed or reported unavailable
      only because owner controls remain off;
    - calendar refresh completed, changed, unchanged, fallback, or unavailable
      according to the documented controls, without exposing provider data.
12. Record sanitized status/preflight output, the Heroku release, GitHub SHA,
    formation, add-on plan names, health-check results, coordinator readiness,
    approver, and date.

Only after all reactivation checks pass may the owner create, start, or activate
the next League Season.

### Seasonal recovery

Partial shutdown recovery:

1. Stop further seasonal mutations.
2. Restore `web=1:Basic` if availability is needed.
3. Restore the prior Papertrail plan if the downgrade failed or removed needed
   diagnostics.
4. Re-run seasonal status and database preflight.
5. Record the exact failed step and sanitized provider state.

Partial reactivation recovery:

1. Keep the next League Season inactive.
2. If HTTP health fails, follow the deployment failure guidance in this
   runbook before retrying.
3. If migrations fail, do not roll back by guess. Confirm the failed release
   state and prepare a forward fix or exact approved rollback.
4. If Papertrail upgrade fails, keep web availability decision separate from
   log-capacity recovery and monitor current quota.
5. If JawsDB is missing, treat it as an incident. Do not create a replacement
   database or restore backups without a separate owner-approved recovery plan.

## Failure and recovery

Determine whether the failure occurred in validation, Heroku build/release, or
post-deploy health checking before taking action.

ESPN adapter failures log only an allowlisted category (HTTP status, timeout,
DNS, TLS, connection, or unknown) and an optional numeric HTTP status. Never
add response bodies, headers, raw exception messages, query parameters,
network addresses, or configuration values to these diagnostics.

Prefer a forward fix through a pull request when the previous release remains
healthy. For rollback:

1. Inspect recent releases and resolve the exact known-good release.
2. Evaluate migration and stored-data compatibility.
3. Obtain explicit approval for the exact rollback target.
4. Run `heroku releases:rollback <release> --app loser-league`.
5. Verify the homepage, NFL Teams route, dyno state, and resulting release.

Never automate rollback or infer the target solely from relative position.

### Database connection capacity

The production database User permits ten concurrent connections. Each Loser
League process has a fixed Sequelize pool maximum of two, leaving headroom for
overlapping web, release, and bounded one-off processes. Startup logs only the
safe pool maximum and acquisition timeout; it never logs the database URL,
host, User, or credentials.

An exact `max_user_connections` capacity failure returns a generic HTTP 503
with `Retry-After`. Three such failures within 60 seconds cause that web process
to stop lifecycle coordinators, stop accepting requests, wait at most ten
seconds for in-flight work, close its pool, and exit. Heroku replaces the dyno
and owns repeated-crash backoff. Generic connection failures, query errors,
pool acquisition timeouts, and provider failures do not trigger this recovery.

If recovery repeats, inspect sanitized `database_capacity_*` events and dyno
process overlap. Do not repeatedly invoke one-off commands, retrieve database
configuration, or increase the application pool. Disable optional high-rate
diagnostics, preserve aggregate evidence, and prefer a forward correction. A
manual `web.1` restart remains available for an isolated incident after the
exact target is confirmed; verify the homepage, `/api/nfl/teams`, calendar
feed, login, and dashboard afterward.

## Credential rotation

Create a replacement dedicated Heroku authorization, update the
`HEROKU_API_KEY` production-environment secret without displaying it, and
observe one successful deployment. Then revoke the superseded authorization.
Pick deadline calendar launch is owner-deferred. Do not set
`PICK_REMINDERS_CALENDAR_AVAILABLE=true` during PR 5 deployment. Final launch
requires a confirmed exact HTTPS `PUBLIC_APP_ORIGIN`, successful beta
subscription/update/cancellation checks in Apple or Google Calendar plus
Outlook, and explicit owner approval. Repository defaults remain fail-closed.
