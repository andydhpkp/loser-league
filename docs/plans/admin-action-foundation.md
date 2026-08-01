# Change contract: Shared-admin action foundation

## Problem and outcome

- The shared-password admin page currently performs add-win, Track creation,
  Track deletion, and User deletion through general-purpose routes. Only
  add-win verifies the admin session, and none of the operations has a persisted
  preview or append-only audit.
- Build the #12A foundation so every current admin mutation is authorized,
  registered, previewed, stale-checked, transactional, and audited without
  turning admins into Users or identifying an individual admin.

## Scope

- In scope:
  - Preserve the existing shared `ADMIN_PASSWORD` and eight-hour session.
  - Register `ADD_USER_WIN`, `CREATE_TRACK`, `DELETE_TRACK`, and `DELETE_USER`.
  - Add shared-admin-only registry, preview, confirmation, and audit-list routes.
  - Persist short-lived one-use previews bound to normalized intent and relevant
    state versions.
  - Persist append-only operation and target audit rows in the mutation
    transaction.
  - Move the admin browser's four mutations to the registered routes.
- Explicitly out of scope:
  - Admin/User roles, an Admin model/table, actor attribution, or User login.
  - Track inspector, repairs, resets, buyback, executable undo, Admin Guide,
    weekly closure, submission, auto-pick, completion, or rollover.
  - Removing legacy routes used by User flows or manual repair workflows.
- Existing gameplay behavior remains unchanged.

## Behavior

- `GET /api/admin/actions` returns sanitized action definitions.
- `POST /api/admin/actions/:action/preview` validates normalized intent and
  stores a short-lived preview. It returns the action, generated description,
  warnings, affected numeric IDs, sanitized before/after state, expiry, and a
  one-time confirmation key.
- `POST /api/admin/actions/:action/confirm` reauthorizes through the session,
  hashes the supplied key, locks and reloads targets, rejects expired, consumed,
  wrong-action, or stale previews, and commits the mutation plus audit rows in
  one transaction.
- Confirmation replay returns the already-committed audit result and never
  repeats a mutation.
- Optional notes are trimmed, length-limited, and never required.
- User/Track deletion is audited and never marked undoable.
- Add-win preserves existing idempotent/upgrade behavior. Track creation uses
  the existing NFL Team catalog and creates blank Pick state for the open 2026
  League Season during Week 0 or Week 1. The schedule-aware enrollment deadline
  is introduced by #13; until then this expand-phase action preserves the
  legacy Week-1 allowance rather than claiming to enforce kickoff eligibility.
- Responses and audits exclude passwords, hashes, sessions, email addresses,
  request bodies, and arbitrary model serialization.

## Interfaces and data

- New tables:
  - `admin_action_preview`: key hash, action, normalized intent, sanitized
    preview, League Season/week/state version, expiry, consumed timestamp, and
    committed audit-operation reference.
  - `admin_audit_operation`: action, generated description, optional note,
    status, League Season/week, sanitized summary, undo metadata, and timestamps;
    no actor column.
  - `admin_audit_target`: operation, target type/numeric ID, sanitized
    before/after state, and state version.
- New routes live under `/api/admin/actions`; all require the shared-admin
  session before parsing target intent or performing lookups.
- The admin browser stops using general User/Track routes for its mutations.
  Those legacy routes remain unchanged for known non-admin/manual consumers in
  this expand phase.

## Design

- The action registry owns stable names, descriptions, warnings, instructions,
  undo policy, and action-specific preview/execute adapters.
- A preview service owns confirmation-key generation/hashing, expiration,
  persistence, stale validation, locking, idempotent replay, and audit writes.
- Express adapters own request/response mapping only. Domain/application code
  does not import Express.
- Audit operations and targets are append-only at application level.
- Preview TTL is ten minutes. Confirmation keys are random 256-bit values and
  only their SHA-256 hashes are stored.

## Safety and delivery

- Every route requires `req.session.adminAuthenticated === true`; Admin remains
  wholly separate from User authentication.
- Mutations and audit rows share one serializable transaction.
- Target locks and stored state versions reject concurrent or stale confirms.
- Migrations are additive and forward-only. The prior application ignores the
  new tables, so application rollback remains compatible.
- Preview and audit logs contain aggregate identifiers and safe error types
  only; no personal data or credentials.

## Verification

- Unit tests cover registry completeness, authorization before lookup,
  sanitization, key hashing, expiry, wrong-action/stale/replay behavior, and
  browser preview/confirm calls.
- Disposable-MySQL integration tests cover schema constraints, atomic mutation
  plus audit, rollback, and concurrent confirmation.
- Run unit, coverage, browser lint, integration, migration replay, and browser
  smoke gates before opening the PR.

## Decisions and open questions

- Resolved:
  - Shared password/session remains the only admin identity.
  - No audit actor exists.
  - Existing browser admin mutations are the four registered actions in #12A.
  - Delete actions are non-undoable; #12B implements action-specific undo for
    eligible repair actions.
  - Previews expire after ten minutes and are one-use.
- Open questions: none for #12A.

## Completion

- Issue #12 was updated so superseded User-admin language is removed.
- Route, architecture, operations, and lifecycle-program docs were updated.
- The lifecycle record includes foundation deployment `v258`, deletion of 314 obsolete legacy Tracks,
  preservation of Users, and successful 2026 Week-0 bootstrap.
- Final PR gate on 2026-08-01:
  - `npm run test:unit` — passed, 84 tests.
  - `npm run test:unit:coverage` — passed, 84.98% line coverage.
  - `npm run lint:browser` — passed.
  - `npm run test:integration` — passed, 10 tests against disposable MySQL.
  - `npm run test:smoke` — passed, 7 Playwright tests.
  - `git diff --check` — passed.
- Residual risk: legacy general-purpose mutation routes remain until their
  known non-admin/manual consumers are migrated in later program PRs. The
  schedule-aware Week-1 Track-creation cutoff is intentionally deferred to #13.
- Next safe step: merge, verify production migration/health, then begin #13.
