# Heroku deployment operations

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
4. The job records the current Heroku release and pushes that exact SHA to
   Heroku Git.
5. Heroku runs the `release` command, applying reviewed forward migrations
   before activating the new web release. A migration failure blocks release.
6. The workflow verifies that a new Heroku release reached `succeeded`; Git
   push success and health from the prior release are not sufficient.
7. The web process verifies database connectivity without synchronizing schema.
8. The workflow polls the production homepage and `/api/nfl/teams`.

League Season foundation deployments require the separate explicit bootstrap
documented in [`league-season-bootstrap.md`](league-season-bootstrap.md).
Migrations intentionally do not infer or populate production lifecycle state.

A failed test prevents deployment. A failed Heroku build or release leaves the
prior release active and fails the workflow before HTTP health checks. A failed
health check marks the workflow failed but does not perform an automatic
rollback.

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
