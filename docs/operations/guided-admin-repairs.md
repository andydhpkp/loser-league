# Guided admin repair runbook

Use `/admin.html` with the shared Admin password. Admin is separate from User
login. Begin every repair by inspecting the numeric Track ID and checking its
normalized Picks, active Pick cycle, elimination, projections, eligibility,
inconsistencies, reactivations, and recent operations.

The Admin Guide on that page is generated from the authenticated action
registry. Use it for current instructions, warnings, and undo status for every
guided action.

## Current-week repairs

- **Assign missing Pick:** for an active Track with no normalized pending Pick.
- **Replace pending Pick:** for an active Track whose current normalized Pick
  is still pending.
- **Reset pending Pick:** deletes only that normalized pending Pick, clears its
  current projection, and returns its Team to current-cycle eligibility.
- **Reset every current Pick:** applies that reset transactionally to every
  active Track and requires `RESET EVERY TRACK`. One unsafe target blocks the
  whole operation.

Assign and replace may run after kickoff. The Team must be scheduled for the
current week and unused by that Track in the active Pick cycle. Reset does not
rerun auto-pick; repair the missing Pick explicitly before closure.

## Week 1 buyback

Ordinary Week 2 buybacks use the dedicated queue documented in
[`week-2-buyback.md`](week-2-buyback.md). It records the User's terminal season
decision and exact requested/fulfilled membership.

Standalone reactivation is an exceptional correction. Confirm payment outside
Loser League, provide the required audit note, and correct only an incorrectly
recorded Track. The server preserves its factual `WRONG_PICK` and used Team,
records reactivation evidence, and intentionally leaves buyback decision state
unchanged.

## NFL playoff Pick reset

At League Week 19, before any Week 19 Pick or automatic selection, type
`RESET PICKS FOR PLAYOFFS`. The operation advances the season to Pick cycle 2
and gives every Track—active or eliminated—a fresh Team pool. It does not
reactivate eliminated Tracks or erase factual Pick history.

This operation is league-wide and non-undoable. Once cycle 2 exists, do not
roll production back to code that is unaware of Pick cycles; deploy a forward
fix.

## Historical correction and reconciliation

Correct one settled historical Pick by entering its Pick ID and actual Team.
The server reloads the stored Fixture schedule and current ESPN/official-result
evidence for that closed week, recomputes the outcome, and rebuilds the owning
Track projections in the same transaction. It rejects a correction that would
create an elimination before already-recorded later Picks.

Outcome reconciliation leaves Team selections unchanged. It can target
specific Pick IDs in one closed week or every Pick in that week. The all scope
requires `RECONCILE EVERY PICK`. Only outcomes that differ from authoritative
results are changed; one unsafe target blocks the batch.

Projection rebuild derives current Pick, current-cycle used/available Teams,
and active elimination from normalized Picks, the Team catalog, Pick cycle,
and durable reactivations. It can target the inspected Track or every Track;
the all scope requires `REBUILD EVERY TRACK`. It never changes normalized Pick
history, and an already-consistent selection produces no mutation audit.

## Conditional undo

Enter the audit operation ID shown by the inspector. Reset, assign, replace,
buyback, historical correction, reconciliation, and projection rebuild can be
undone once only while every affected target still exactly matches the
operation's recorded after-state. Undo restores business fields while
advancing state versions, records its own non-undoable audit, and links the
original operation as `UNDONE`. There is no redo or undo-of-undo.

Deletion, official-result override, manual closure, season transition, win,
and playoff reset operations are never undoable.

## Failure and recovery

Preview does not mutate data. Confirmation reloads and locks state; stale,
expired, replayed-with-different-state, or unsafe requests fail without a
partial change. Successful operations and sanitized before/after target states
are audited transactionally. Retained raw emergency routes are also admin-only
and transactionally audited, but they are intentionally non-undoable and are
not shown in the guide. Prefer guided actions; reserve raw routes for
exceptional owner repairs whose existing low-level contract is specifically
needed.
