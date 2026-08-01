# Change contract: League Season and normalized Pick foundation

## Problem and outcome

- League year/week authority is split across hard-coded server dates, browser
  schedule calculations, and browser storage.
- Track Pick state is stored in semicolon-delimited arrays and duplicate scalar
  fields without durable week identity.
- Add a server-authoritative League Season and normalized weekly Pick model that
  later PRs can use for submission, auto-pick, weekly results, admin repair, and
  rollover.
- This is the first PR in
  [`league-lifecycle-program.md`](league-lifecycle-program.md).
- GitHub issue: [#27](https://github.com/andydhpkp/loser-league/issues/27).

## Scope

- In scope:
  - forward-only expand migrations for League Season, Track association,
    normalized Picks, elimination reference, compact schedule snapshots, and
    exactly-once lifecycle operation records;
  - model associations and domain invariants;
  - explicit idempotent bootstrap of one active production League Season/year;
  - read/projection seams that can compare normalized and legacy Track state;
  - Week 0/active/complete/rolled-over state validation;
  - documentation and disposable-MySQL migration/invariant tests.
- Explicitly out of scope:
  - changing the shared-password admin authentication flow;
  - final User Pick submission or Pick visibility;
  - timers, auto-pick execution, result processing, or week advancement;
  - guided admin audit/preview/repair UI;
  - season completion, export, or rollover execution;
  - removing legacy Track columns or active routes.
- Affected workflows:
  - Deployment gains an explicit bootstrap/recovery step before lifecycle
    mutations can be enabled.
  - Existing browser behavior remains compatible during the expand phase.

## Behavior

- User-visible behavior:
  - No intentional UI change in this foundation PR.
- Acceptance criteria:
  - The database can represent one authoritative League Season year/week and
    normalized Picks with exact week identity.
  - Only one League Season may be in setup/active operation.
  - A Track belongs to one League Season after bootstrap.
  - A Track has at most one Pick per League Season/week and cannot reuse a Team
    in the same League Season.
  - A Track's eliminating Pick belongs to that Track/season and has a Wrong Pick
    outcome.
  - Current, used, available, Wrong Pick, and elimination projections preserve
    current behavior.
  - Application lifecycle writes fail closed until explicit bootstrap and
    parity validation succeed.
- Failure and edge cases:
  - Missing, malformed, unsupported, duplicate, or conflicting bootstrap year,
    state, or week fails without partial writes.
  - Existing Tracks already associated with a different season block bootstrap.
  - Partial legacy state, duplicate Teams, reused Teams, inconsistent current
    Pick, and ambiguous Wrong Pick block normalized backfill and report only
    sanitized counts/reasons.
  - Known legacy Week 1 buybacks require explicit numeric Track IDs because the
    cleared legacy `wrong_pick` field cannot prove their factual outcome.
  - Repeating the same completed bootstrap is a no-op; a conflicting repeat is
    rejected.
- Invariants:
  - A committed active-week Pick counts as used immediately.
  - Available Teams exclude every Team selected by that Track in the season.
  - Track elimination is represented by a nullable reference to the exact Wrong
    Pick row.
  - Buyback can later clear that reference without changing the factual Pick
    outcome or Pick history.

## Interfaces and data

- Routes, methods, and response bodies:
  - Existing route contracts remain during the expand phase.
  - No public route may accept authoritative League Season year/week as part of
    this PR.
- Pages and browser interactions:
  - No page change.
- Models and migrations:
- `league_season`: explicit year, current week, state, state version, and
    timestamps. A nullable unique `open_slot` sentinel provides a portable
    database constraint allowing only one setup/active season; application
    state transitions maintain the state/sentinel invariant.
  - `track.league_season_id`: nullable during expand/backfill; made non-null only
    in a later contract migration after production verification.
  - normalized `pick`: Track/season/week, Team, origin, outcome, commit metadata,
    and version metadata; unique Track/season/week and Track/season/Team keys.
  - `track.eliminated_by_pick_id`: nullable exact Pick reference.
  - normalized compact schedule snapshot/version records.
  - `league_week_operation`: unique League Season/week/phase success marker with
    mode and sanitized summary.
  - Legacy Track Pick fields remain temporary compatibility projections.
- External systems and consumers:
  - No live provider call is required for migration or bootstrap.
  - Later integrations read the stored active year through one server seam.
- Compatibility:
  - Use expand/backfill/contract delivery. Do not remove or reinterpret legacy
    fields in this PR.

## Design

- Module boundaries:
  - Pure League Season/Pick invariant and projection modules contain no Express,
    DOM, or process startup dependencies.
  - Application/bootstrap services own transactions, locking, idempotency, and
    model access.
  - Migrations remain forward-only and do not read environment secrets or guess
    production data.
- Considered alternatives:
  - Hard-coded/environment current week was rejected because the confirmed
    program requires durable lifecycle authority.
  - Retaining only semicolon-delimited Pick arrays was rejected because it
    cannot safely identify weeks, enforce uniqueness, bind previews, or lock
    concurrent operations.
  - Permanent historical Track/Pick storage was rejected; rollover deletes it.
- ADR:
  - Add an ADR if implementation establishes a surprising database constraint
    technique for enforcing the one-open-season invariant in the supported
    MySQL version. Otherwise the confirmed plan is authoritative.

## Safety and delivery

- Authentication and authorization:
  - No new browser mutation is introduced. Bootstrap is an explicit operational
    command, not a public route.
- Sensitive data:
  - Bootstrap and parity output reports IDs only when operationally necessary
    and otherwise uses counts/reason codes. It never prints Users, Picks,
    credentials, sessions, emails, environment values, or connection strings.
- Migration and rollout:
  1. Apply additive schema migrations compatible with the current application.
  2. Run dry-run bootstrap/parity checks using an explicit four-digit year,
     League Season state, and current week.
  3. Run idempotent transactional bootstrap for exactly one active season and
     all existing Tracks.
  4. Verify counts, normalized/legacy parity, constraints, and application
     health.
  5. Leave Track association nullable until a later PR confirms production
     completion and applies the contract migration.
- Rollback/recovery:
  - Application rollback remains compatible with additive tables/columns.
  - A failed bootstrap transaction changes nothing.
  - After successful bootstrap, recovery uses forward corrective migrations or
    an idempotent repair command; do not down-migrate shared production data.
- Observability:
  - Emit one sanitized bootstrap summary and safe reason-coded failures.

## Verification

- Regression/characterization:
  - Characterize legacy Track projection behavior before normalized backfill.
- Unit tests:
  - League Season states/week bounds, Pick uniqueness, projection parity,
    elimination reference rules, bootstrap validation, and idempotency.
- Integration tests:
  - Forward migrations, associations, uniqueness constraints, transactions,
    conflicting/concurrent bootstrap, rollback, and normalized legacy backfill
    against disposable MySQL only.
- Browser smoke tests:
  - Existing pages remain functional with additive schema and compatibility
    projections.
- Manual/live checks:
  - Never inspect or print production Track/User/Pick data. Production bootstrap
    requires an explicit user-approved operational step after merge.

## Decisions and open questions

- Resolved decisions:
  - All decisions recorded in the program plan are authoritative.
  - Admin identity is unrelated to this schema.
  - Existing Tracks are bootstrapped using an explicit year.
  - Normalized Picks become authoritative through staged migration while legacy
    fields remain compatibility projections.
- Open questions:
  - Exact legacy-state parity blockers must be enumerated from current model and
    route behavior before production bootstrap. Current dry-run blockers cover
    empty Teams, reused Teams, used/available overlap, excess weeks, mismatched
    current Pick, and ambiguous Wrong Pick.
- Owners/external dependencies:
  - Repository owner supplies and confirms the intended production League
    Season year at bootstrap without sharing production data or credentials.

## Completion

- Documentation:
  - Update this contract, the program tracker, architecture, behavior, routes,
    operations, migration/bootstrap, recovery, glossary, and security docs.
- Residual risks:
  - Legacy and normalized state temporarily coexist; parity gates and focused
    write boundaries are required until legacy columns retire.
  - Production bootstrap cannot be verified in tests and remains an explicit
    post-merge operational step.
- Next safe step:
  - Enumerate current database/runtime constraints and legacy Track-state
    shapes, then add the first failing pure invariant/model migration test.
