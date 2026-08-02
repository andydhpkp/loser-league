# Change contract: Lifecycle program cleanup and handoff

Confirmed: 2026-08-02

## Problem and outcome

- The multi-PR lifecycle program is live, but browser compatibility code and
  tracker language still describe superseded ownership of week selection,
  result polling, buyback mutation, and a fixed 2025 Fixture route.
- Finish the program by deleting only proven-dead browser paths, making the
  stored League Season week authoritative in the remaining Pick UI, reconciling
  delivered GitHub issues, and adding one durable implementation summary.

## Scope

- In scope:
  - remove the hard-coded `localStorage` Week 12 and the erroneous increment of
    the server-provided current week;
  - filter Fixture matchups with the exact stored League Season week;
  - remove no-op browser result polling/current-week discovery and dead
    browser buyback helper functions;
  - remove the unreferenced `/api/proxy/nfl-2025` compatibility route;
  - preserve `/api/proxy/nfl`, whose year is resolved from stored season state;
  - close delivered Issue #17, classify unrelated open issues, reconcile
    tracker status and route inventory, and add the requested full-program
    summary document.
- Explicitly out of scope:
  - deleting retained raw repair endpoints, changing their contracts, or
    removing the Team bootstrap path;
  - Google SSO, zero-Track onboarding content, dependencies, schema changes,
    or production data operations.

## Behavior

- The Pick page uses `submission.leagueSeason.week` exactly, without adding one
  or consulting browser storage.
- Fixture games shown for selection belong to that exact week.
- League rendering no longer performs a duplicate Fixture fetch whose result
  is unused.
- Browser modules no longer schedule a no-op hourly timer or contain unused
  direct Wrong Pick reset/look-up helpers.
- The dynamic Fixture proxy remains the only active Fixture proxy. Its year is
  server-owned.
- Raw repair routes remain authenticated, audited owner tools because the
  owner explicitly confirmed they are used for one-engineer fixes.

## Safety and verification

- Add a pure week-filter regression test before changing the Pick UI.
- Reference-search every deletion and preserve active callers.
- Run unit, coverage, browser lint, disposable-MySQL integration, and browser
  smoke gates before PR creation.
- No migration is required. Rollback before any real rollover is ordinary;
  after a rollover, lifecycle rollback remains forward-fix only.

## Decisions

- No unresolved questions. This applies the previously confirmed program
  contract: server season state is authoritative, compatibility wrappers for
  hypothetical consumers are unnecessary, and intentionally used raw repair
  endpoints remain available.
