# Change contract: Dedicated server-side NFL routes

## Problem and outcome

- Browser modules request ESPN through the generic
  `pacific-anchorage-21728.herokuapp.com` CORS proxy.
- Replace those requests with narrowly scoped, same-origin Loser League routes
  so the browser no longer depends on the generic proxy.
- Preserve the current ESPN response shapes and browser behavior.

## Scope

- In scope:
  - Add public, read-only routes for ESPN NFL Teams and weekly Schedule data.
  - Restrict upstream requests to fixed, approved ESPN endpoints.
  - Validate Schedule year and week inputs.
  - Add an upstream timeout and safe error responses.
  - Migrate active browser callers and remove verified-dead proxy code.
- Explicitly out of scope:
  - A Scoreboard route without an active consumer.
  - Normalizing ESPN response bodies.
  - Server-side response caching or automatic upstream retries.
  - Changing or renaming the Fixture Download `/api/proxy/nfl-2025` route.
  - Selecting the authoritative League Season year.
  - Disabling or deleting the Pacific Anchorage Heroku app.
- Affected workflows:
  - Team-logo rendering.
  - Weekly matchup rendering.
  - Weekly result-color, odds, and team-record data reads.

## Behavior

- User-visible behavior remains unchanged.
- `GET /api/nfl/teams` returns the approved ESPN Teams JSON unchanged.
- `GET /api/nfl/schedule?year=<year>&week=<week>` returns the approved ESPN
  Schedule JSON unchanged.
- The routes are publicly readable because they expose only public NFL data.
- `year` must be one canonical integer from 2000 through the server's current
  year plus one.
- `week` must be one canonical integer from 1 through 22.
- Missing, repeated, fractional, signed, text-padded, or out-of-range inputs
  receive a safe `400` response.
- Upstream timeout, network failure, non-success status, or malformed JSON
  receives the existing safe `502 UPSTREAM_ERROR` response.
- Upstream requests time out after five seconds and are not retried.

## Interfaces and data

- Routes:
  - `GET /api/nfl/teams`
  - `GET /api/nfl/schedule?year=<year>&week=<week>`
- Browser callers use only these same-origin URLs for ESPN Teams and Schedule
  data.
- The Fixture Download route remains unchanged.
- No models, migrations, stored data, or credentials are involved.
- The pass-through response bodies preserve compatibility with current browser
  consumers.

## Design

- A focused ESPN client owns fixed upstream URLs, the timeout, response-status
  checks, and JSON parsing.
- A dedicated NFL router owns query validation and HTTP response mapping.
- The application factory injects `fetchImpl` into the client/router seam for
  deterministic tests.
- Browser modules know only the same-origin Loser League URLs.
- No new dependency is required; Node's built-in `fetch` and abort support are
  sufficient.

## Safety and delivery

- No authentication is required for public, read-only NFL data.
- Clients cannot supply an upstream hostname or URL.
- Errors do not expose upstream bodies, internal exceptions, request bodies,
  secrets, sessions, or personal data.
- Rollback is the application commit rollback; the external Pacific Anchorage
  app remains available until a later, separately approved cleanup.
- After deployment, verify the affected pages and server routes before
  separately considering proxy retirement.

## Verification

- Regression tests cover successful pass-through responses and exact approved
  upstream URLs.
- Unit/HTTP tests cover accepted boundaries, invalid input forms, timeout,
  network failure, non-success status, malformed JSON, and safe errors.
- Browser smoke tests cover same-origin calls and preservation of current page
  behavior.
- `npm run lint:browser` verifies changed browser modules.
- A repository search must find no Pacific Anchorage hostname outside
  historical evidence where retaining it is intentional.
- MySQL integration tests are not required because this change has no route,
  model, session, transaction, migration, or database behavior.

## Decisions and open questions

- Resolved decisions:
  - Pass through ESPN JSON unchanged.
  - Omit the unused Scoreboard route.
  - Use the confirmed year/week bounds.
  - Keep routes public.
  - Use a five-second timeout, no retries, and no server cache.
  - Delete verified-unused ESPN functions and stale proxy comments.
  - Preserve the Fixture Download route.
  - Retire the external proxy only after separate production verification and
    approval.
- Open questions: None.
- External dependency: ESPN endpoint availability and response compatibility.

## Completion

- Update current route, architecture, behavior, and operations documentation.
- Residual risk: ESPN may change its undocumented response shape.
- Next safe step after merge: deploy, verify both routes and affected pages,
  then separately approve retirement of the Pacific Anchorage Heroku app.
