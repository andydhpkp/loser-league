# Change contract: Exactly-once weekly results and closure

Confirmed: 2026-08-01

## Problem and outcome

- The League page currently interprets ESPN results in the browser and then
  performs league-wide mutations through legacy Track and Team routes.
- Browser tabs, refreshes, deployments, and concurrent requests can repeat or
  partially apply elimination, current-Pick clearing, and week advancement.
- Move result reconciliation and weekly closure to one server-authoritative,
  database-locked lifecycle operation while preserving the current game rules.
- GitHub issue: #11. This is pull request 5 of the League lifecycle program.

## Scope

- In scope:
  - reconcile the complete Fixture Download schedule with ESPN terminal game
    results by League Season year, week, and both Teams;
  - schedule efficient result polling from known kickoff times, with startup
    catch-up and delayed-game backoff;
  - atomically settle normalized Picks, eliminate Tracks, clear compatibility
    current-Pick fields, record `CLOSE_WEEK`, and advance at most one week;
  - add a shared-admin preview/confirm workflow for immutable official-result
    overrides and early manual closure;
  - make League-page result coloring read-only and remove its lifecycle writes;
  - document operations, routes, lifecycle behavior, and rollout.
- Explicitly out of scope:
  - identifying an individual admin or associating admins with Users;
  - repairing or correcting a committed override or closed week;
  - Week 1 buyback, Pick resets, general repair tools, or undo;
  - completing, exporting, or rolling over a League Season;
  - removing raw repair routes that remain useful to the repository owner;
  - deleting legacy Track or Team columns.
- Affected workflows:
  - Users may view final game coloring while games are underway, but the page
    cannot eliminate Tracks or advance the League Season.
  - Automatic closure becomes a server lifecycle responsibility.
  - A shared admin may supply an official result or close early through a
    stale-checked preview/confirm action.

## Behavior

- User-visible behavior:
  - The League page remains available during games and colors a visible Pick
    only after ESPN reports its game explicitly terminal.
  - No Wrong Pick, elimination, current-Pick clearing, or week change becomes
    visible until the week closes.
- Acceptance criteria:
  - Fixture Download defines the expected active-week schedule. ESPN explicit
    terminal status or a committed official-result override defines a result.
  - Games match by League Season year/week and the unordered pair of Teams,
    never feed array position.
  - Automatic closure waits until every scheduled game has an authoritative
    terminal result.
  - Manual closure is allowed only after auto-pick completed and every active
    Track's selected game has an authoritative terminal result. Its preview
    lists unfinished unselected games and confirmation requires a note.
  - Closure locks and revalidates the League Season, schedule, results, Picks,
    Tracks, and existing phase marker in one transaction.
  - Automatic and manual attempts compete for one unique `CLOSE_WEEK` marker;
    the loser returns an already-completed result without repeating mutations.
  - A selected Team loss sets the Pick to `PREDICTION_CORRECT` and the Track
    survives. A selected Team win or tie sets `WRONG_PICK`, points
    `eliminated_by_pick_id` to that Pick, and projects the Team to legacy
    `wrong_pick`.
  - Every processed Track has legacy `current_pick` cleared. Legacy
    `used_picks` and `available_picks` remain unchanged.
  - Closing Weeks 1 through 21 advances exactly one week. Closing Week 22
    records completion of that weekly phase but leaves the League Season
    `ACTIVE` at Week 22 for the separate explicit completion workflow.
- Failure and edge cases:
  - Missing games, duplicate matchups, Team reuse, malformed results,
    contradictory feeds, a nonterminal selected game, missing Pick, or stale
    season/schedule state fails closed without partial writes.
  - A non-null score is not proof that a game is terminal.
  - Postponed or suspended games block automatic closure.
  - Late results for unfinished unselected games cannot reopen a manually
    closed week or change its Picks.
  - An exact repeat of an official override is idempotent; a conflicting
    override is rejected. Corrections belong to the later repair contract.
- Invariants:
  - A Wrong Pick means the selected Team did not lose; a tied game is a Wrong
    Pick for either selected Team.
  - Closure never creates a missing Pick or reruns auto-pick.
  - At most one successful closure and one week advancement exist for each
    League Season/week.
  - `Team.team_record` is neither authoritative nor updated by closure.

## Interfaces and data

- Routes, methods, and response bodies:
  - Add authenticated registered admin actions for official-result override
    and manual week closure using the existing preview/confirm routes.
  - Extend the stable League view/result response only as required for
    read-only result coloring and safe lifecycle status.
  - Do not expose a public force-close or result-mutation route.
- Pages and browser interactions:
  - The League page reads the server-authoritative year/week and ESPN result
    data, colors completed visible Picks, and performs no Track or Team writes.
  - The admin page previews and confirms official overrides/manual closure
    through the existing action workflow.
- Models, migrations, and stored data:
  - Add a forward-only official-result override table unique by League Season,
    week, and canonical matchup. Store sanitized terminal result metadata,
    explanation, optional source URL, schedule hash, timestamps, and actorless
    audit linkage.
  - Reuse `LeagueWeekOperation` with phase `CLOSE_WEEK` for the unique success
    marker and sanitized summary.
  - Keep normalized Pick rows authoritative and legacy Track fields as
    temporary compatibility projections.
- External systems and consumers:
  - Fixture Download supplies the complete schedule and kickoff times.
  - ESPN supplies terminal status and scores. Kickoff/duration estimates only
    decide when to poll; they never decide a result.
- Compatibility expectations:
  - Preserve League-page result coloring and existing Pick semantics.
  - Intentionally supersede browser-owned weekly mutations. Retain raw repair
    endpoints until later mapped-repair work proves each replacement.
  - Additive schema remains compatible with the prior application during
    rollout.

## Design

- Proposed module boundaries and dependency flow:
  - Pure reconciliation and weekly-outcome functions validate schedules and
    produce deterministic result/Track transitions without Express or models.
  - A closure evaluator obtains external snapshots and chooses `NOT_DUE`,
    `BLOCKED`, or a closure attempt.
  - One closure service owns the serializable transaction, locks, validation,
    outcome writes, compatibility projection, operation marker, and week
    advancement.
  - Extend the existing lifecycle coordinator with expected-finish timers,
    collapsed weekly polling, startup catch-up, and recovery. External clients,
    time, and timers remain injected boundaries.
  - Admin registry adapters build previews and commit overrides/manual closure
    without putting league rules in Express.
  - The browser page entry owns DOM updates; its NFL data module owns reads.
- Considered alternatives:
  - Page-request wakeups were rejected because startup catch-up and the
    server-owned coordinator are sufficient.
  - Constant one-minute polling from first kickoff was rejected in favor of
    expected-finish windows derived from each kickoff.
  - Inferring completion from elapsed time or non-null scores was rejected.
  - Updating `Team.team_record` was rejected because ESPN is authoritative and
    no current application consumer reads that field for weekly decisions.
- Decisions still requiring an ADR:
  - None. This extends documented lifecycle and deep-module boundaries.

## Safety and delivery

- Authentication and authorization:
  - Admin actions require the existing shared `ADMIN_PASSWORD` server session.
    Admin remains separate from User login and no audit actor is recorded.
- Input, secret, and personal-data handling:
  - Normalize Team identifiers, notes, and optional source URLs at boundaries.
    Never log upstream bodies, sessions, credentials, request bodies, or User
    personal data.
- Migration and rollout:
  1. Apply the additive official-result override migration.
  2. Deploy server reconciliation, closure, admin actions, and read-only page
     behavior together.
  3. Verify migration state, coordinator startup, public health, and safe
     lifecycle diagnostics without mutating production data.
- Rollback or recovery:
  - The prior application ignores the additive table. Application rollback is
    compatible before a new weekly closure commits.
  - A failed closure transaction changes nothing. A committed closure is not
    automatically reversible; corrections use the later audited repair flow.
- Observability:
  - Emit sanitized evaluator status changes, upstream failure reason codes,
    delayed-game backoff, closure mode/week/count summary, already-completed
    contention, and unexpected transaction failure. Do not log one event per
    Track or include Pick identities.

## Verification

- Confirmed public test seams:
  - exported pure weekly-result rules;
  - lifecycle evaluator/coordinator and closure service interfaces;
  - authenticated HTTP/admin preview-confirm routes;
  - disposable-MySQL migration and transactional behavior;
  - League page entry/read-only result-rendering behavior.
- Regression or characterization test:
  - Characterize final-game coloring and prove League-page execution performs
    no Track/Team mutation requests.
- Unit tests:
  - Team-pair reconciliation, explicit terminal status, win/loss/tie outcomes,
    missing/duplicate/contradictory schedules, automatic/manual eligibility,
    expected-finish polling, collapsed windows, delayed backoff, startup
    catch-up, idempotent overrides, and Week 22 behavior.
- Integration tests and disposable database:
  - Forward migration/replay and constraints; atomic Pick/Track/season/marker
    writes; rollback; concurrent automatic/manual closure; stale preview;
    authorization; override audit/idempotency/conflict.
- Browser smoke tests:
  - League page loads, uses server year/week, colors terminal visible Picks,
    and issues no legacy mutation requests. Admin preview/confirm remains
    accessible only through an authenticated admin session.
- Manual or live-data checks:
  - Run the complete documented PR gate. After merge, verify Heroku migration,
    exact deployed SHA, coordinator startup, `/`, and `/api/nfl/teams` without
    forcing or previewing a production closure.

## Decisions and open questions

- Resolved decisions:
  - All behavior, authority, polling, override, manual-close, Track-state, and
    Week 22 decisions above were confirmed in the grill session.
  - Official overrides are immutable for this PR, require an explanation, and
    allow an optional source URL. Confirmation stores the override/audit and
    then asks the closure evaluator to recheck; it does not close inline.
  - Expected-finish polling begins approximately two hours forty-five minutes
    after each kickoff, polls at most once per minute across overlapping games,
    and backs delayed/suspended/postponed games off to five-minute checks while
    refreshing the Fixture schedule.
- Open questions: none.
- Owners or external dependencies:
  - Fixture Download and ESPN availability remain external dependencies;
    failure blocks mutation safely.

## Completion

- Documentation to update:
  - League lifecycle program, NFL data, architecture, behavior and route
    contracts, admin access/guide surfaces, weekly-closure operations, and the
    final program action summary.
- Residual risks:
  - Provider Team naming can drift; canonical matching must reject unknown or
    ambiguous Teams rather than guess.
  - Legacy raw repair endpoints remain powerful until the mapped-repair PR.
- Next safe step:
  - Add the first failing pure reconciliation test, implement that vertical
    slice, and continue red-to-green through transaction, coordinator, admin,
    and browser seams.
