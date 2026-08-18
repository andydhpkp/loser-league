# Heroku deployment operations

> Pick Reminders owner setup is deferred. Before any beta, configure the exact HTTPS canonical origin; push/VAPID settings; and the dedicated Gmail sender, app password, credential version, and versioned email token key. Keep system, email, push, and public release controls off until the full launch checklist passes. Never place real values in source or deployment transcripts.

PR 6 adds the integrated UI and fail-closed readiness gate but authorizes no Heroku changes. Follow the complete owner setup, controlled-beta, monitoring, rotation, incident, rollback, and launch checklist in [`pick-reminders.md`](pick-reminders.md). Readiness never enables public release automatically.

Loser League deploys the exact tested `main` commit through
`.github/workflows/test-and-deploy.yml`.

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

## Credential rotation

Create a replacement dedicated Heroku authorization, update the
`HEROKU_API_KEY` production-environment secret without displaying it, and
observe one successful deployment. Then revoke the superseded authorization.
Pick deadline calendar launch is owner-deferred. Do not set
`PICK_REMINDERS_CALENDAR_AVAILABLE=true` during PR 5 deployment. Final launch
requires a confirmed exact HTTPS `PUBLIC_APP_ORIGIN`, successful beta
subscription/update/cancellation checks in Apple or Google Calendar plus
Outlook, and explicit owner approval. Repository defaults remain fail-closed.
