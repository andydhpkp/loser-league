# Change contract: Guided admin repairs, buyback, and playoff Pick cycles

Confirmed: 2026-08-01

## Problem and outcome

- Raw Track repair endpoints preserve useful one-engineer emergency capabilities
  but expose low-level array/projection mutations without consistent preview,
  transactions, stale checks, or audit.
- The shared admin needs a safe Track inspector and guided repairs that operate
  on normalized Picks while preserving every existing emergency capability.
- Buyback must reactivate the existing Track without erasing its factual Wrong
  Pick, and reaching the NFL playoffs must reset Team eligibility without
  erasing regular-season Pick history.
- GitHub issues: #12B and #17. This work follows production PR #34/#11.

## Scope

- In scope:
  - authenticated Track inspector and sanitized audit history;
  - selected/all current-week Pick reset;
  - assign or replace an open-week Pick through shared-admin repair;
  - guided buyback reactivation with durable factual waiver evidence;
  - manual exactly-once Week 19 playoff Pick-pool reset;
  - historical Pick correction and selected/all-week outcome reconciliation;
  - selected/all Track projection rebuild;
  - exact one-level conditional undo for safe repair actions;
  - shared-admin authorization, transactions, and actorless audit for every
    retained raw emergency repair mutation;
  - registry-derived authenticated Admin Guide;
  - route inventory, mappings, behavior, architecture, and operations docs.
- Explicitly out of scope:
  - Admin accounts, User roles, or actor attribution;
  - payment collection or payment data;
  - fabricating missing historical Picks;
  - reopening closed weeks or changing the authoritative week through repair;
  - correcting immutable official results or reversing manual closure;
  - season completion, export, rollover, or deleting retained raw routes.
- Affected workflows:
  - shared-admin inspection, current-week correction, historical correction,
    Week 1 buyback guidance, playoff eligibility, audit, undo, and emergency
    repair; ordinary User login and Pick submission contracts remain separate.

## Behavior

- User-visible behavior:
  - The admin inspector shows User display name/username, Track and League
    Season identity, authoritative week, normalized Pick history, current
    eligibility, elimination cause, legacy projections/inconsistencies, and
    recent sanitized operations/undo status. It excludes email and account data.
  - Guided actions always preview exact before/after state. League-wide reset,
    reconciliation, and rebuild require typed scope-specific confirmation.
  - Repair notes are optional and system descriptions are generated. Buyback
    requires a confirmation that payment was handled externally but stores no
    payment data.
- Acceptance criteria:
  - Current-week reset deletes only `PENDING` Picks in the open week, restores
    their Team to the current cycle, clears current projections, and supports
    selected or all-active scopes.
  - `ASSIGN_CURRENT_PICK` fills a missing open-week Pick and
    `REPLACE_CURRENT_PICK` replaces one existing pending Pick. Both enforce the
    validated weekly schedule, current cycle availability, and schedule hash,
    including after kickoff/auto-pick as explicit repairs.
  - Historical correction changes one existing Pick Team, recomputes its
    authoritative outcome, and rejects a past elimination when later Picks
    already exist.
  - Outcome reconciliation supports selected Picks or every Pick in one closed
    week, never changes Teams or the League Season week, and fails atomically.
  - Projection rebuild supports selected/all Tracks and derives compatibility
    fields from normalized Picks, current eligibility cycle, authoritative
    outcomes, and durable reactivations.
  - Buyback requires an existing eliminated Track, records the waived Pick,
    clears only `eliminated_by_pick_id`/legacy `wrong_pick`, preserves the
    factual `WRONG_PICK` and Team usage, and makes the Track fully active.
  - Week 1/payment timing is prominent guidance, not server enforcement.
  - Manual playoff reset is allowed exactly once at Week 19, before any Week 19
    Pick or auto-pick. It changes cycle 1 to 2 and resets every Track's legacy
    `used_picks` to empty and `available_picks` to the Team catalog while
    preserving normalized history and elimination state.
  - Every retained raw mutation requires shared-admin authorization, executes
    transactionally, and creates a sanitized non-undoable
    `LEGACY_EMERGENCY_REPAIR` audit without changing route contracts.
  - Every registered action has complete guide metadata and the guide is
    available only to authenticated admins.
- Failure and edge cases:
  - Missing, active/ineligible, stale, settled, wrong-season/week, reused-Team,
    invalid-schedule, contradictory-result, later-history, changed-record, and
    concurrent targets fail closed.
  - Any invalid selected target or unsafe league-wide target blocks the entire
    confirmation; there is no partial batch commit.
  - Reset can intentionally leave an active Track without a Pick. Closure stays
    blocked until guided assignment completes; auto-pick never reruns.
  - Consistent reconciliation/rebuild targets are explicit no-ops and do not
    create redundant mutation audits.
- Invariants:
  - Admin is never a User and audits have no actor.
  - Normalized Picks remain factual and ordered; no repair fabricates a Pick.
  - A Team is used at most once per Track, League Season, and Pick cycle.
  - Legacy used/available projections are disjoint within the current cycle.
  - A Track cannot become eliminated before already-recorded later Picks.
  - Buyback waives one eliminating Pick but later Wrong Picks eliminate normally.

## Interfaces and data

- Routes, methods, and response bodies:
  - Reuse authenticated `/api/admin/actions/:action/preview` and `/confirm` for
    mutations and undo.
  - Add authenticated read-only inspector/history interfaces under
    `/api/admin`.
  - Register reset, assign, replace, buyback, playoff reset, historical
    correction, reconciliation, projection rebuild, and undo actions.
  - Preserve raw emergency route method/path/input/success contracts while
    adding shared-admin authorization, transaction, and audit.
- Pages and browser interactions:
  - Add an admin-only inspector/operations area, selected-versus-every scope
    labeling, typed confirmation for high-impact actions, undo state, and a
    registry-derived Admin Guide.
  - Remove the old profile-page raw buyback mutation caller.
- Models, migrations, and stored data:
  - Add `league_season.pick_cycle` and `pick.pick_cycle`, default/backfill 1.
  - Replace Pick Team uniqueness with Track + League Season + Pick cycle + Team.
  - Add a `track_reactivation` event linked to Track, League Season, waived
    eliminating Pick, admin audit operation, and timestamp.
  - Reuse preview/audit operation/target tables and one-level undo linkage.
- Compatibility expectations:
  - Prior application versions remain compatible before the first playoff
    reset. After cycle 2 begins, rollback to cycle-unaware code is unsafe and
    recovery must be a forward fix.
  - Retained raw emergency routes remain callable with an authenticated admin
    session and are removed only in the final cleanup PR after mapping proof.

## Design

- Pure planners own eligibility-cycle, current/historical Pick, outcome,
  projection, reactivation, and undo transformations.
- Focused application services own model loading, schedule/result evidence,
  locks, transactions, preview revalidation, idempotency, and audit.
- Express adapters parse requests and map responses only. Admin page entries
  own DOM binding; browser modules never calculate repair state.
- League-wide operations lock/revalidate every target and commit all proposed
  writes plus audit in one transaction.
- Considered alternatives:
  - Erasing/placeholder Pick history at playoffs was rejected in favor of
    explicit cycles and factual normalized history.
  - Inferring buyback solely from audit was rejected in favor of a durable
    reactivation event.
  - Raw field/array editing was rejected as the guided interface; deterministic
    projection rebuild and normalized repairs replace routine use.
- ADR: none currently required; the decisions extend the existing normalized
  Pick and actorless admin architecture.

## Safety and delivery

- Every inspector, guide, preview, confirm, undo, and retained emergency repair
  verifies the shared eight-hour admin session before target lookup.
- Never return/store/log email, credentials, sessions, request bodies, payment
  details, personal data, or unnecessary Pick ownership details.
- Deliver sequentially:
  1. PR 6A: schema, inspector, current reset/assign/replace, buyback, playoff reset.
  2. PR 6B: historical correction, outcome reconciliation, projection rebuild,
     and conditional undo.
  3. PR 6C: retained raw-route authorization/transactional audit, complete
     registry-derived Admin Guide/UI, and mapping evidence.
- Migrations are forward-only. Application rollback is compatible before the
  manual Week 19 reset. That preview warns that cycle 2 creates a forward-fix
  boundary.
- Sanitized logs record action type, scope, counts, result, and conflict/error
  type without Track/Pick/User payloads.

## Verification

- Pure tests: eligibility cycles, current/historical Pick transformations,
  buyback waiver, outcome/projection derivation, batch blocking, undo safety.
- HTTP tests: shared-admin authorization before lookup, sensitive-field
  exclusion, action/guide registry, validation, typed confirmation, safe errors.
- Disposable-MySQL tests: migrations/replay, cycle uniqueness, transaction
  rollback, concurrency, exact replay, reactivation, all-or-none batches, audit,
  undo, and raw emergency wrapping.
- Browser tests: inspector rendering, selected/all labeling, typed phrases,
  buyback/payment guidance, undo state, and authenticated guide access.
- Playwright smoke: inspector and representative current-week, playoff, and
  guide workflows.
- Every PR runs the complete repository PR gate without skips.

## Decisions and open questions

- Resolved decisions: all behavior, scope, cycles, reactivation, batch,
  authorization, audit, guide, undo, compatibility, delivery, and test seams
  above were confirmed in the grill session.
- Open questions: none.
- External dependencies: Fixture Download and ESPN evidence may block a repair
  safely when authoritative schedule/result data is unavailable.

## Completion

- Update #12/#17, program tracker, route inventory, behavior, architecture,
  admin access/guide, operations, glossary, and final program action summary.
- Residual risk: retained raw emergency endpoints remain powerful even when
  authenticated/audited; final cleanup still requires mapping/reference proof.
- PR 6A implementation includes the forward Pick-cycle/reactivation migration,
  authenticated inspector and admin-page entry, current reset/assign/replace,
  durable buyback, manual playoff reset, and cycle-aware ordinary submission
  and auto-pick paths. The complete repository PR gate passed on 2026-08-01.
- Next safe step: finish PR 6B review/documentation and run the complete PR
  gate.
- PR 6A merged as PR #35 and deployed in Heroku v263. PR 6B implements
  historical correction, authoritative outcome reconciliation, deterministic
  projection rebuild, and exact one-level conditional undo; its final review
  and complete repository gate passed on 2026-08-02.
