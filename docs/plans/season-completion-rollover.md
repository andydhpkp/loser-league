# Change contract: Explicit League Season completion and rollover

Confirmed: 2026-08-01

## Problem and outcome

- League Season completion and new-year rollover do not yet have a
  server-authoritative workflow.
- Add shared-admin actions that explicitly record the winning Tracks/Users,
  complete a closed League Season, generate a checksum-bound sanitized JSON
  export, permanently delete outgoing Tracks/Picks, preserve Users/wins and
  compact evidence, and create the explicitly entered successor year at Week
  0.
- GitHub issue: #14. This is PR 7 of the lifecycle program and follows
  production PR #37/Heroku v265.

## Scope

- In scope:
  - previewed `COMPLETE_LEAGUE_SEASON` with selected winning Track IDs;
  - server-derived unique winning Users and solo/tied win records;
  - previewed `ROLLOVER_LEAGUE_SEASON` with a blank, required target year;
  - minimal sanitized JSON export bound to a deterministic checksum;
  - exactly-once transactional rollover and actorless audits;
  - dynamic active-year propagation and hard-coded-year verification;
  - authenticated admin UI, operations, routes, architecture, issue, and
    program tracking.
- Explicitly out of scope:
  - Admin accounts, User roles, actor attribution, CSV/reporting UI, stored
    export artifacts, raw-route deletion, password reset, or retaining
    historical Tracks/Picks in the database.
- Affected workflows:
  - shared-admin completion/export/rollover only; ordinary User login remains
    separate.

## Behavior

- User-visible behavior:
  - Admin selects one or more winning numeric Track IDs and previews the
    derived unique winning Users and solo/tied result before completing.
  - Admin enters a blank, required four-digit successor year. There is no
    inferred `+1`, browser-clock, or server-clock default.
  - Rollover preview returns exact preserved/deleted counts and a downloadable
    sanitized JSON export. Confirmation uses a normal Yes/No dialog and is
    bound to that export checksum and state snapshot.
- Acceptance criteria:
  - Completion requires an `ACTIVE` League Season after a durable closed-week
    marker, with no Pick or lifecycle operation in the newly open week.
  - Every winning Track belongs to that season. The server deduplicates owners:
    one unique User receives a solo win; multiple unique Users each receive a
    tied win; multiple winning Tracks owned by one User still yield one solo
    User win.
  - Completion writes win history, changes the season to `COMPLETE`, clears
    `open_slot`, advances `state_version`, and commits one non-undoable audit in
    one transaction.
  - Rollover requires `COMPLETE`, a different unused target year, a valid
    Fixture Download season, and the exact unexpired preview/export snapshot.
  - One transaction deletes outgoing Track-owned data and Picks, preserves
    Users/win records, schedule snapshots, lifecycle summaries, official
    overrides, and append-only audits, marks the outgoing season
    `ROLLED_OVER`, and creates target year `SETUP` at Week 0/cycle 1.
  - Replay/concurrent confirmations create one successor and never delete
    successor Tracks.
- Failure and edge cases:
  - Missing/duplicate/nonseason winning Tracks, no winner, stale state, current
    week Picks/work, malformed/conflicting year, invalid/empty upstream data,
    changed export checksum, and concurrent mutation fail without partial
    writes.
  - Completion does not guess winners. Rollover never silently falls back to a
    different year or provider response.
- Invariants:
  - Admin is never a User and audits have no actor.
  - Users, credentials, and complete win history survive rollover.
  - Outgoing Tracks and normalized Picks do not survive rollover.
  - At most one `SETUP`/`ACTIVE` League Season exists.

## Interfaces and data

- Routes:
  - reuse authenticated `POST /api/admin/actions/:action/preview` and
    `/confirm` for `COMPLETE_LEAGUE_SEASON` and
    `ROLLOVER_LEAGUE_SEASON`;
  - rollover preview includes `exportDocument`, `exportChecksum`, filename,
    counts, warnings, and affected IDs; confirmation accepts the one-use key.
- Browser:
  - add completion and rollover controls to `/admin.html`;
  - create the JSON download only from the server preview, then ask Yes/No and
    confirm that exact preview.
- Models/migrations:
  - reuse League Season states/version/open-slot, Picks, previews, audits,
    lifecycle operations, and User win history;
  - no schema migration is expected unless implementation proves an existing
    invariant cannot be represented safely.
- Export:
  - schema version, generated timestamp, outgoing season identity/state/week,
    sanitized Track state, normalized Pick facts, counts, and checksum;
  - exclude names, email, passwords/hashes, sessions, request bodies, secrets,
    payment data, and environment values. Numeric User ownership IDs are
    sufficient for recovery context.
- Compatibility:
  - prior code can read `COMPLETE` but cannot safely operate after rollover;
    production rollback after the first rollover uses a forward fix.

## Design

- Pure policy/export modules validate winners, completion eligibility, target
  year, derive User wins, normalize the export, and hash canonical JSON.
- Application services load provider evidence before mutation, then own locks,
  preview revalidation, transactions, deletion ordering, idempotency, and
  audit.
- Express remains an adapter; the admin page entry owns download and DOM
  binding.
- Season locks serialize completion/rollover against submission, auto-pick,
  closure, and guided repair services. After acquiring the lock, the service
  rechecks current-week Picks and lifecycle markers before writing.
- A separate stored export artifact was rejected because the owner does not
  need reporting/retention; the persisted preview binds the checksum and exact
  normalized snapshot.
- ADR: none; this completes the established lifecycle architecture.

## Safety and delivery

- Every preview/confirm verifies the shared eight-hour admin session before
  lookup. Confirmation reauthorizes and revalidates.
- Destructive scope is always the locked outgoing League Season ID, never all
  future/unassociated Tracks. The admin sees exact counts before Yes/No.
- No production data is inspected during development. Tests use only a
  runtime-verified disposable schema whose name contains `test`.
- A failed completion/rollover transaction changes nothing. After successful
  production rollover, recovery uses the downloaded checksum-verified export
  and a forward repair; database rollback is not promised.
- Logs/audits contain action, season/year/week, counts, status, and safe reason
  codes only.

## Verification

- Pure tests: winner derivation/deduplication, completion eligibility, export
  canonicalization/checksum, year validation, and sensitive-field exclusion.
- HTTP/browser tests: early authorization, registry guide metadata, preview,
  download-before-confirm, Yes/No cancellation, safe failures.
- Disposable-MySQL tests: win/complete atomicity, stale and concurrent
  completion, deletion ordering, User/win/evidence preservation, rollback,
  exact replay, one-open-season invariant, and successor Week 0.
- Integration search/tests prove executable NFL integrations use stored year
  authority and no behavior remains pinned to 2025.
- Run the complete repository PR gate without skips.

## Decisions and open questions

- Resolved decisions: all behavior, scope, winner derivation, blank target
  year, minimal JSON export, checksum binding, deletion/preservation,
  authorization, concurrency, audit, recovery, and test seams above were
  confirmed in the lifecycle grill.
- Open questions: none.
- External dependency: Fixture Download must recognize the target season and
  return a structurally valid schedule before rollover preview succeeds.

## Completion

- Update issue #14, program tracker, action registry/Admin Guide, behavior,
  routes, architecture, operations, and final program action summary.
- Residual risk: the owner must retain the downloaded export externally;
  rollover is intentionally destructive and non-undoable.
- Next safe step: add failing pure policy/export and authenticated action tests,
  then implement completion before rollover.
