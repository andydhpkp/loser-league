# Change contract: Login persistence and authenticated redirect

## Problem and outcome

- The browser currently submits persistent-login consent unconditionally, and
  the server creates a ten-year cookie.
- The login form lacks complete labels, names, and autofill metadata.
- An authenticated User can still load the login page.
- Login and registration currently serialize the raw User model, which can
  expose its password hash.
- Users will get standards-compatible autofill, a consistent six-month
  session, and server-authoritative navigation away from login.

## Scope

- In scope: User login and registration response sanitization, mandatory User
  session cookie duration and clearing, login-page routing, safe post-login
  return, login-form semantics, tests, and authentication documentation.
- Explicitly out of scope: generic invalid-credential responses, rate limiting,
  admin-session policy, registration persistence choices, password reset
  redesign, authentication frameworks, schema changes, and dependencies.
- Affected workflow: User login, authenticated visits to the login page, and
  User logout. Tracks and League Season rules do not change.

## Behavior

- Username and password have accessible names supplied through `aria-label`,
  form names, and `username` and `current-password` autocomplete tokens. Their
  visible prompts remain the input placeholders; no separate label elements
  are rendered.
- Every successful login creates a 180-day cookie. Persistence is not exposed
  as a User choice.
- The browser does not send a persistence field. A legacy `staySignedIn` field
  is ignored so it cannot shorten or lengthen the mandatory duration.
- Username is trimmed; password is submitted exactly as entered.
- Authenticated requests for `/` or `/index.html` redirect to
  `/dashboard.html`. Missing, expired, unsigned, or malformed User sessions
  remain on login.
- A fresh login preserves only the existing safe
  `returnTo=/reminder-settings.html` destination. Arbitrary destinations fall
  back to `/dashboard.html`. An already-authenticated redirect ignores
  `returnTo`.
- Logout destroys the server session, clears the authentication cookie, and
  returns the existing `204`; a missing session retains the existing `404`.
- Passwords, hashes, session identifiers, cookies, credentials, and request
  bodies are not returned or logged.

## Interfaces and data

- `POST /api/users/login` always creates a 180-day User session. The request
  needs only the existing username and password credentials.
- Successful login keeps `{ user, message }`, but `user` contains only `id`
  and `username`.
- Successful `POST /api/users` retains its status and returns a sanitized User
  projection rather than the raw model.
- `POST /api/users/logout` retains its status behavior and additionally clears
  `connect.sid` at path `/`.
- `GET /` and `GET /index.html` become session-aware login-page routes.
- No model, migration, stored application data, or external consumer changes.

## Design

- `server/app.js` owns login-page serving and authenticated redirect because it
  already owns session middleware and static route ordering.
- `controllers/api/user-routes.js` owns persistence validation, sanitized
  authentication responses, and logout clearing.
- `public/js/login.js` owns checkbox submission and safe destination choice.
- `public/index.html` owns login semantics and visible controls.
- Extract only a small session-policy helper if duplication requires it. Do not
  introduce a new authentication framework or broad controller refactor.
- No ADR is required; the change follows existing dependency boundaries and is
  readily reversible.

## Safety and delivery

- The server session remains the only authentication authority. Autofill and
  browser storage never prove login.
- User cookies remain `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- No password is stored by application JavaScript or copied to local storage.
- Deployment needs no migration or coordinated external rollout. Rollback is
  the prior application release; existing sessions retain their issued expiry
  until logout or expiration.
- Existing safe error logging remains metadata-only. No new credential logging
  is added.

## Verification

- HTTP/controller tests cover mandatory 180-day persistence, ignored legacy
  persistence values, sanitized login and registration responses, and logout
  cookie clearing.
- Application tests cover authenticated `/` and `/index.html` redirects and
  missing, malformed, and expired/invalid session behavior.
- Browser tests cover the absence of a persistence choice, password whitespace,
  autofill markup, and safe return handling.
- Run `npm run test:unit`, `npm run test:unit:coverage`,
  `npm run lint:browser`, integration tests with a disposable database whose
  name contains `test`, and `npm run test:smoke`.
- No live-data or external-service check is required.

## Decisions and open questions

- Resolved: server-side login-page redirect; mandatory fixed 180-day duration
  with no User choice; sanitized login and registration responses; active
  cookie clearing; accessible credential controls without separate labels;
  both login URLs;
  unchanged invalid-credential messages; focused module boundaries; and the
  verification seams above.
- Open questions: none.
- External dependencies: a disposable MySQL test schema for required
  integration verification.

## Completion

- Update authenticated navigation, route/API documentation, and this plan with
  any material implementation discovery.
- Residual risk: already-issued ten-year cookies are not shortened until the
  User logs in again, logs out, or the stored session expires independently.
- Next safe step: write failing regression tests, implement the focused change,
  update documentation, and run all required checks.
