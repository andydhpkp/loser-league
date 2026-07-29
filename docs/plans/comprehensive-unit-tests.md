# Change contract: comprehensive unit and route-contract tests

## Problem and outcome

The application has 55 API endpoints but only 11 unit tests. Core behavior,
failure contracts, operational routes, and deterministic browser calculations
can regress without fast feedback. This change adds isolated characterization
coverage without intentionally changing application behavior.

## Scope

- Cover every User, Team, Track, maintenance, force-pick, repair, and proxy
  endpoint through an Express application instance.
- Cover domain transformations, model accessors and methods, safe
  errors/logging, database-test guards, and deterministic standings
  calculations.
- Add reusable test helpers and an 80% native Node line-coverage gate for the
  declared unit-testable modules.
- Exclude database-schema changes, visual changes, new product behavior, and
  fixes for newly discovered defects.

## Behavior and compatibility

Existing route URLs, methods, successful response bodies, model storage shapes,
and browser outcomes remain compatibility constraints. Tests characterize
success, applicable validation and not-found branches, model/transaction call
shape, and safe failures. Confirmed defects are documented rather than fixed.

## Design

Use `node:test`, strict assertions, and Supertest. Stub imported Sequelize model
methods at the public route seam and restore them after every test. Extract
deterministic browser calculations into a dependency-free ES module. Introduce
dependency injection only where time, randomness, transactions, or module-level
state otherwise prevents deterministic isolation; retain existing default
exports.

## Safety and delivery

Tests do not call external networks or shared databases. Integration tests
continue to require a disposable `TEST_DATABASE_URL` containing `test`.
Production dependencies, routes, schemas, and deployment behavior do not
change.

## Verification

- `npm run test:unit`
- `npm run test:unit:coverage`
- `npm run lint:browser`
- `npm run test:integration` with a disposable database when configured
- `npm run test:smoke`, with pre-existing failures reported

## Completion

Implemented with the following evidence:

- `npm run test:unit`: 46 passing, 2 skipped known-defect regressions.
- `npm run test:unit:coverage`: passing at 84.21% line coverage.
- `npm run lint:browser`: passing.
- `npm run test:integration`: safely skipped because `TEST_DATABASE_URL` is not
  configured.
- `npm run test:smoke`: four passing; the existing league-page
  `AwayTeamScore` failure remains reproduced.

The test work confirmed two promise-chain double-response defects, recorded in
`docs/refactor/known-issues.md`. The next safe step is to fix each through its
skipped regression test in a separate bug-fix change, then run MySQL integration
coverage with a disposable database.
