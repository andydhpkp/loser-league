# Change contract: Login persistence and authenticated redirect

## Problem and outcome

- The browser currently submits persistent-login consent unconditionally, and
  the server creates a ten-year cookie.
- The login form lacks complete labels, names, and autofill metadata.
- An authenticated User can still load the login page.
- Login and registration currently serialize the raw User model, which can
  expose its password hash.
- Users will get standards-compatible autofill, an explicit six-month
  persistence choice, and server-authoritative navigation away from login.

## Scope

- In scope: User login and registration response sanitization, User session
  cookie duration and clearing, login-page routing, safe post-login return,
  login-form semantics, tests, and authentication documentation.
- Explicitly out of scope: generic invalid-credential responses, rate limiting,
  admin-session policy, registration persistence choices, password reset
  redesign, authentication frameworks, schema changes, and dependencies.
- Affected workflow: User login, authenticated visits to the login page, and
  User logout. Tracks and League Season rules do not change.

## Behavior

- Username and password have visible labels, form names, and `username` and
  `current-password` autocomplete tokens.
- **Keep me signed in for six months** is visible and checked by default.
- Checked login sends `staySignedIn: true` and creates a 180-day cookie.
- Unchecked login sends `staySignedIn: false` and creates a browser-session
  cookie. An omitted flag also defaults to a browser-session cookie.
- A supplied non-boolean persistence value receives a safe `400` response.
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

- `POST /api/users/login` accepts optional boolean `staySignedIn`; omission is
  session-only and any other supplied type is invalid.
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

- HTTP/controller tests cover checked, unchecked, omitted, and malformed
  persistence; 180-day and session-only cookies; sanitized login and
  registration responses; and logout cookie clearing.
- Application tests cover authenticated `/` and `/index.html` redirects and
  missing, malformed, and expired/invalid session behavior.
- Browser tests cover exact checkbox submission, password whitespace,
  autofill markup, checked-by-default presentation, and safe return handling.
- Run `npm run test:unit`, `npm run test:unit:coverage`,
  `npm run lint:browser`, integration tests with a disposable database whose
  name contains `test`, and `npm run test:smoke`.
- No live-data or external-service check is required.

## Decisions and open questions

- Resolved: server-side login-page redirect; fixed 180-day duration; explicit
  boolean request contract; sanitized login and registration responses;
  active cookie clearing; visible semantic form controls; both login URLs;
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
