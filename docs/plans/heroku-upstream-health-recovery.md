# Change contract: Recover transient Heroku upstream health failures

## Problem and outcome

- Heroku release `v333` successfully built, migrated, started, and served the homepage, but its first web dyno returned `502 UPSTREAM_ERROR` for every `/api/nfl/teams` deployment health check.
- A fresh one-off dyno on the same release reached ESPN successfully, and restarting the `web` process type restored both production health checks without changing code, configuration, releases, or data.
- Make this one bounded, evidence-backed recovery available to routine deployments and improve safe upstream failure diagnostics.

## Scope

- In scope: the GitHub-to-Heroku deployment health step, ESPN client failure classification, request error logging, tests, and deployment documentation.
- Explicitly out of scope: automatic rollback, repeated restarts, changing ESPN providers, caching NFL data, changing public error responses, schema changes, and production configuration changes.
- The behavior applies to both new deployments and idempotent reruns of an already-deployed tested SHA.

## Behavior

- Keep the live homepage and ESPN-backed NFL Teams health checks.
- Run the existing bounded health retries before recovery.
- If the homepage is unhealthy, fail without restarting.
- If the homepage is healthy but `/api/nfl/teams` remains unhealthy, report an upstream-health failure, restart the Heroku `web` process type once, then rerun both bounded health checks.
- If both checks recover, record the automatic recovery and succeed.
- If either check remains unhealthy, fail without another restart or rollback.
- Classify ESPN failures as `UPSTREAM_HTTP_STATUS`, `UPSTREAM_TIMEOUT`, `UPSTREAM_DNS`, `UPSTREAM_TLS`, `UPSTREAM_CONNECTION`, or `UPSTREAM_UNKNOWN`.
- Log only the category and, for HTTP failures, the numeric status.

## Interfaces and data

- Public route methods, response bodies, and status codes remain unchanged.
- `GET /api/nfl/teams` remains live and ESPN-backed.
- Sanitized `request_failed` log context gains `upstreamFailure` and optional `upstreamStatus` for classified ESPN failures.
- `.github/workflows/test-and-deploy.yml` gains one bounded `web` process-type recovery path.
- No models, migrations, stored data, or secrets change.

## Design

- The ESPN adapter owns classification because it has the HTTP response or network failure evidence.
- `UpstreamError` carries only allowlisted diagnostic fields; the HTTP error middleware copies those fields into sanitized structured logs.
- The deployment workflow uses a shell health-check function for both initial and post-restart verification.
- A live NFL health check is retained because it verifies required production functionality; a shallow internal endpoint would hide dependency failure.
- No ADR is required.

## Safety and delivery

- Authentication and authorization are unchanged.
- Diagnostics never include response bodies, headers, raw exception messages, query parameters, addresses, credentials, configuration values, or production data.
- Recovery uses `heroku ps:restart --process-type web` once and may cause a brief request interruption.
- Deployments remain serialized. No automatic rollback is added.
- Rollback remains the existing explicit, exact-release procedure.

## Verification

- Unit tests cover every allowlisted ESPN diagnostic category and ensure raw failure details are not logged.
- The deployment contract test requires initial retries, homepage-gated recovery, one process-type restart, both post-restart checks, and no restart loop.
- Validate workflow structure and run unit tests, coverage, browser lint, disposable-database integration tests, and browser smoke tests before pull request creation.

## Decisions and open questions

- Resolved: one automatic web process-type restart; only after homepage success and persistent NFL failure; both checks rerun; applies to new deploys and idempotent reruns; live ESPN check retained; sanitized diagnostic categories added.
- Open questions: none.
- Owners or external dependencies: GitHub Actions, Heroku, and ESPN.

## Completion

- Update the Heroku deployment plan and operations runbook.
- Residual risk: a persistent Heroku or ESPN outage still fails deployment after one restart; classification depends on stable Node network error codes.
- Next safe step: add failing contract tests, implement the bounded recovery and diagnostics, then run the complete gate.
