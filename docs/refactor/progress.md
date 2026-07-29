# Refactor progress

## Status

Historical. The behavior-preserving refactor was merged in pull request #8.
Future work follows `docs/engineering/README.md`.

## Completed

- Mapped pages, routes, models, browser script tags, large files, logging, and
  error handling.
- Agreed on behavior-preserving scope, native ES modules, staged delivery,
  disposable MySQL integration tests, Node 22 LTS, and proven-dead cleanup.
- Defined approved test seams in `README.md`.
- Created the durable documentation structure and root agent instructions.
- Separated Express application creation from process startup.
- Added safe request IDs, application errors, structured logging, and error
  middleware.
- Added Node 22 runtime configuration and built-in upstream `fetch`.
- Split the 2,019-line track router into five behavior modules.
- Extracted and tested pure pick-state transitions.
- Added guarded disposable-MySQL integration coverage.
- Added five Playwright page smoke scenarios and a static test server.
- Replaced classic shared scripts and inline handlers with one ES-module entry
  per page.
- Split browser implementation into modules; the largest active browser file
  is now 753 lines and `app.js` is a seven-line compatibility interface.
- Removed three unreferenced browser scripts and the superseded auto-pick
  implementation.
- Consolidated the model loader used by routes and seeds.
- Fixed documented route, URL, secret-logging, force-pick, and strict-module
  defects.
- Ensured failed force-pick commits do not activate global or per-track
  cooldowns, with disposable-MySQL regression coverage.
- Removed the browser-exposed Odds API credential and routed the unchanged
  admin odds workflow through a server proxy configured by `ODDS_API_KEY`.

## Verification

- Unit/route tests: 11 passing.
- Browser ESLint and ES-module syntax checks: passing.
- Server/controller syntax checks: passing.
- MySQL integration suite: safely skipped because `TEST_DATABASE_URL` is not
  configured.
- Playwright suite: four scenarios pass; the league-page scenario reproduces
  the `AwayTeamScore` failure recorded in `known-issues.md`.
- Documentation foundation commit: `2e47d0c`.

The evergreen engineering-documentation transition was verified with
`git diff --check`, `npm run lint:browser`, `npm run test:unit` (11 passing),
`npm run test:integration` (safely skipped without `TEST_DATABASE_URL`), and
`npm run test:smoke` (four passing and the documented league-page failure).

## Next

Run the integration suite with a disposable MySQL schema and the Playwright
league-page scenario with representative score data. Address only failures
reproduced through those interfaces.

Establish full-suite CI so unit, integration, lint, and browser verification
become merge gates. This file is no longer updated for routine future work.

## 2026 comprehensive-test defect follow-up

- Corrected the duplicate-response paths characterized by the User add-win and
  individual Track-reduction route tests.
- Corrected league score rendering for empty or incomplete upstream schedule
  data; all five browser page-entry smoke scenarios now pass.
- Unit/route coverage: 49 passing, 84.57% line coverage.
- Browser ESLint: passing.
- MySQL integration suite: safely skipped because `TEST_DATABASE_URL` is not
  configured.

The next safe step is to run the integration suite against a disposable MySQL
database before creating the pull request.
