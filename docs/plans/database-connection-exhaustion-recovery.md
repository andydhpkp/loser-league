# Change contract: Prevent and recover from database connection exhaustion

## Problem and outcome

- Production exhausted the database User's ten-connection limit on 2026-08-20.
  Database-backed pages, the calendar feed, reminder coordination, and static
  assets returned `INTERNAL_ERROR` until the web dyno was restarted.
- Sequelize currently uses its implicit five-connection pool. Two overlapping
  processes can therefore consume the complete database allowance without
  recovery headroom.
- Session middleware also runs before nearly every static request, and
  `saveUninitialized: true` permits anonymous requests to create stored
  sessions.
- Prevent ordinary process overlap and public-asset traffic from exhausting
  the database, and recover automatically from a confirmed capacity incident.

## Scope

- In scope:
  - an explicit production database pool maximum of two connections;
  - route-scoped session loading and no persistence of unchanged anonymous
    sessions;
  - safe HTTP classification of the exact database-capacity failure;
  - bounded process recovery after three capacity failures within 60 seconds;
  - graceful coordinator, HTTP-server, and database shutdown within ten
    seconds before Heroku restarts the process;
  - tests, architecture guidance, and Heroku operations documentation.
- Explicitly out of scope:
  - Web Push provider rejection and installed-app badge behavior;
  - generic database/query retry, automatic Heroku API calls, database-plan
    changes, schema changes, and dependency upgrades;
  - automatic restart for pool acquisition timeouts, provider errors, or
    unrelated application failures.
- Affected workflows are public/static page delivery, authenticated sessions,
  background lifecycle coordination, and production incident recovery. League,
  Track, Pick, and reminder eligibility rules do not change.

## Behavior

- Public static assets are served without loading or storing a session.
- Anonymous page/API requests do not persist a session unless a route changes
  it. Login, authenticated redirects, admin authority, and logout retain their
  existing contracts.
- An exact database `max_user_connections` capacity failure returns HTTP 503,
  `Retry-After`, and
  `{ "error": "SERVICE_UNAVAILABLE", "message": "Loser League is temporarily unavailable. Try again shortly." }`.
- Other unexpected failures remain the existing safe HTTP 500
  `INTERNAL_ERROR` response.
- Three exact capacity failures within a rolling 60-second window trigger one
  recovery for the process. Recovery stops lifecycle coordinators, stops new
  HTTP connections, permits at most ten seconds for in-flight work, closes the
  Sequelize pool, and exits so Heroku replaces the dyno.
- Recovery is one-shot per process. Heroku owns repeated-crash backoff; the
  application does not call the Heroku API or restart for generic failures.

## Interfaces and data

- Existing successful route bodies, page URLs, session cookies, and API
  authorization remain compatible.
- The new 503 response is limited to recognized database-capacity incidents.
- No model, migration, stored business data, secret, or external provider
  interface changes.
- `config/connection.js` owns the connection-pool contract.
- Disposable test schemas retain their isolated harness pool behavior; the
  fixed two-connection contract applies to deployable application processes.

## Design

- A small infrastructure policy classifies the database-capacity error and
  records its rolling threshold without importing Express or Sequelize models.
- Error middleware maps the recognized failure to the safe 503 response and
  reports the failure to a process recovery coordinator through an injected
  callback.
- Startup composes the recovery coordinator with the listener, lifecycle
  coordinator, Sequelize connection, timer, and process-exit adapter. Domain
  modules remain unaware of process recovery.
- Session middleware remains one shared instance but is mounted only at page
  and API boundaries that require session authority. Public reminder links,
  calendar publication, and static files stay sessionless.
- Alternatives rejected:
  - retaining the implicit pool leaves no capacity contract or headroom;
  - environment-configurable pool size permits silent unsafe configuration;
  - immediate restart on one failure overreacts to a single transient event;
  - Heroku API self-restart adds credentials and external control coupling;
  - restarting on generic database errors risks crash loops and hides defects.
- No ADR is required; the change makes an existing infrastructure constraint
  explicit without changing a hard-to-reverse system boundary.

## Safety and delivery

- Session authentication and authorization remain server-owned.
- Responses and logs contain no database URL, username, connection details,
  query, request body, session, or personal data.
- Deploy through the existing tested-main GitHub-to-Heroku workflow. No owner
  configuration or migration step is required.
- Rollback is an ordinary application release rollback. No stored-data
  recovery is necessary.
- Sanitized startup/recovery logs record configured pool capacity, threshold
  transition, graceful completion, forced deadline, and error type only.

## Verification

- Add a deterministic regression test that asserts the production connection
  factory exposes a two-connection pool rather than Sequelize's default five.
- Unit-test capacity-error classification, rolling-window reset, threshold,
  one-shot recovery, coordinator/server/database cleanup, and forced deadline.
- Unit-test safe 503 mapping and preservation of unrelated 500 behavior.
- Unit/route-order tests prove static assets do not invoke the session store,
  anonymous reads do not persist sessions, and authenticated workflows remain
  compatible.
- Run unit tests, unit coverage, browser lint, disposable-MySQL integration
  tests, and browser smoke tests before a pull request.
- After deployment, verify the homepage, NFL Teams route, calendar feed,
  authenticated login/dashboard, sanitized startup logs, and connection
  headroom without printing configuration values or production data.

## Decisions and open questions

- Resolved decisions:
  - prevention plus bounded automatic recovery;
  - fixed pool maximum of two;
  - three exact capacity failures within 60 seconds;
  - safe 503 with `Retry-After`;
  - scoped sessions and `saveUninitialized: false`;
  - ten-second graceful shutdown deadline;
  - no generic database restart and no Heroku API access.
- Open questions: None.
- External dependency: Heroku must continue replacing an exited web dyno and
  applying its ordinary crash-backoff policy.

## Completion

- Update `docs/refactor/architecture.md`, `docs/operations/heroku-deploy.md`,
  and relevant route/session documentation with the implemented contracts.
- Residual risks:
  - a database provider outage unrelated to connection capacity remains a
    visible safe failure and requires separate diagnosis;
  - a two-connection pool may queue unusually concurrent work, so bounded
    acquisition behavior and production latency require observation;
  - multiple independently restarting processes can still compete, although
    the fixed pool cap retains capacity headroom.
- Next safe step: add failing infrastructure, error-mapping, recovery, and
  route-order tests before changing production code.
