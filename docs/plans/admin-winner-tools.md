# Change contract: Admin winner tools

## Problem and outcome

- The admin page currently compares a shared password in browser source, so the
  password and authorization decision are public.
- The User model and add-win API can record League Season wins, but the admin
  page has no control for recording them.
- Administrators must continue using one shared password without being Loser
  League Users, while the server owns access to the admin page and win write.

## Scope

- In scope:
  - Authenticate the existing shared admin password on the server.
  - Create and clear an eight-hour admin session.
  - Protect `/admin.html` and `PUT /api/users/:id/add-win` with that session.
  - Reuse the home-page Admin password modal as the login entry point.
  - Add win-history display and confirmed solo/tied win controls to the
    existing User modal on the admin page.
  - Update a User's displayed win history and crown type after a successful
    write without reloading the page.
- Explicitly out of scope:
  - User-based admin roles or administrator User accounts.
  - A database column or migration for administrators.
  - Correcting, downgrading, or removing recorded wins.
  - Retrofitting authorization or ownership checks across legacy User and Track
    mutation routes.
  - Rate limiting, multi-factor authentication, or a separate account system.
- Affected Users, Tracks, League Seasons, and workflows:
  - Administrators can add solo or tied League Season wins to a selected User.
  - User login, Track behavior, Pick behavior, public league rendering, and
    existing win classification remain unchanged.

## Behavior

- User-visible behavior:
  - The existing home-page Admin modal submits its password to the server and
    redirects to `/admin.html` on success.
  - Invalid credentials show a generic error and do not create an admin
    session.
  - An unauthenticated `/admin.html` request redirects to the home page.
  - The existing User modal gains a separate League Season win section showing
    current history, a blank required four-digit year, and “Add solo win” and
    “Add tied win” actions.
  - Before either write, the administrator confirms the User, year, and type.
  - Success updates the visible history and crown type without a page reload.
- Acceptance criteria:
  - No admin password or fallback value exists in browser assets, source
    defaults, tests, documentation, logs, commits, or API responses.
  - `ADMIN_PASSWORD` is required at application startup and is read only from
    environment-backed configuration or an explicitly injected test value.
  - Password comparison is timing-safe.
  - Admin sessions expire after eight hours.
  - Unauthorized add-win requests return HTTP 401 and perform no User lookup or
    write.
  - Existing add-win validation, idempotency, tied-upgrade behavior, and
    response fields remain compatible for authorized requests.
- Failure and edge cases:
  - Missing server configuration prevents application startup.
  - Missing, empty, non-string, or incorrect passwords receive the same generic
    HTTP 401 response.
  - Invalid or expired sessions cannot load the admin page or record a win.
  - Invalid year input is stopped in the browser and remains rejected by the
    existing server validation.
  - Canceling confirmation performs no request.
  - A failed write leaves the existing UI state intact and shows a safe error.
- Invariants that must remain true:
  - Admin authentication is independent of User login.
  - The plaintext password is never persisted by the application.
  - `user_record` remains the source of truth and contains at most one win per
    League Season year.

## Interfaces and data

- Routes, methods, and response bodies:
  - `POST /api/admin/login` accepts `{ password }`, creates the admin session,
    and returns HTTP 204; invalid credentials return HTTP 401.
  - `GET /api/admin/session` returns `{ authenticated: true|false }`.
  - `POST /api/admin/logout` destroys the session and returns HTTP 204.
  - `PUT /api/users/:id/add-win` retains its successful and validation response
    contracts and adds the admin-session requirement.
  - `GET /admin.html` redirects unauthenticated clients to `/index.html`.
- Pages and browser interactions:
  - Home-page Admin modal uses the login route instead of comparing a browser
    constant.
  - Admin page logout uses the admin logout route.
  - Existing User modals own win display and controls.
- Models, migrations, and stored data:
  - No model or schema change and no migration.
  - Successful writes use the existing `User.addWin()` behavior.
- External systems and consumers:
  - Heroku must contain the plaintext `ADMIN_PASSWORD` config key before merge.
    The value is managed out of band and never retrieved by this workflow.
- Compatibility expectations:
  - Existing public route and page contracts remain unchanged except that the
    add-win endpoint and admin page now require authorization.

## Design

- Proposed module boundaries and dependency flow:
  - Application configuration injects the admin password into an admin router.
  - Admin router owns login, status, logout, and timing-safe comparison.
  - Reusable server middleware owns the admin-session authorization decision.
  - Application composition orders session middleware before the protected
    admin page and static assets.
  - Browser page-entry and admin modules own DOM binding and HTTP presentation.
- Considered alternatives:
  - A User `is_admin` field was rejected because administrators do not log in
    as Users.
  - Browser-side password comparison was rejected because it cannot authorize
    server writes and exposes the credential.
  - A bcrypt hash was rejected because the administrator requires the shared
    password to remain retrievable through authorized Heroku config access.
- Decisions still requiring an ADR:
  - None. The feature follows existing application, route, and page-entry
    boundaries.

## Safety and delivery

- Authentication and authorization:
  - Use an eight-hour server session, timing-safe comparison, generic failures,
    and no browser fallback credential.
  - Scope authorization to `/admin.html` and the add-win write. Legacy mutation
    authorization is documented follow-up work.
- Input, secret, and personal-data handling:
  - Never log request bodies, submitted passwords, configured values, User
    names, or User records. Do not return the configured password.
  - Use only a User ID from the route path when performing the approved write.
- Migration and rollout:
  - No database migration.
  - The owner sets `ADMIN_PASSWORD` in Heroku before merge. Automatic deployment
    then releases the tested `main` commit.
- Rollback or recovery:
  - Revert the application commit; the configuration key can remain without
    affecting the prior release. No stored-data rollback is required for the
    authorization feature.
  - Incorrectly recorded wins require a separately approved correction process.
- Observability:
  - Preserve safe request/error correlation without logging credentials or
    production User data.

## Verification

- Regression or characterization test:
  - Characterize the existing successful add-win response and admin modal
    structure before changing their behavior.
- Unit tests:
  - HTTP tests cover startup configuration, successful/failed login, session
    status, logout, page redirect/access, unauthorized writes, authorized
    writes, and session expiry semantics.
  - Browser tests cover login request/redirect/failure, blank or invalid year,
    canceled confirmation, solo/tied payloads, success rendering, and safe
    failure rendering through exported page/UI seams.
- Integration tests and disposable database:
  - Run the documented MySQL integration suite against a disposable database
    whose name contains `test`.
- Browser smoke tests:
  - Run all page smoke tests with test-only admin configuration.
- Manual or live-data checks:
  - Do not submit a production win or retrieve production configuration.
  - Verify only that the `ADMIN_PASSWORD` key exists before merge when a safe
    configuration-name-only check is available.

## Decisions and open questions

- Resolved decisions:
  - Administrators use a shared password and are not Users.
  - The plaintext password is an environment secret so the owner can retrieve
    it through authorized Heroku configuration access.
  - The home modal, existing User modal, blank explicit year, confirmation,
    eight-hour session, focused authorization scope, and no-correction scope are
    confirmed.
- Open questions:
  - None for implementation. Production config must be set by the owner before
    merge.
- Owners or external dependencies:
  - Repository owner: set the Heroku `ADMIN_PASSWORD` config value without
    sending or recording it through this workflow.

## Completion

- Documentation to update:
  - This contract, admin operations/configuration documentation, and relevant
    route/behavior documentation.
- Residual risks:
  - The shared plaintext password is readable by authorized Heroku config
    administrators.
  - Existing legacy mutation endpoints still lack comprehensive server-side
    ownership or admin authorization.
  - No login rate limiting is included in this small-app scope.
- Next safe step:
  - Add one failing HTTP login/configuration test, implement the minimal server
    slice, then proceed vertically through authorization and browser behavior.
