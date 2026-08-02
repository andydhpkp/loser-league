# Guided admin repair runbook

Use `/admin.html` with the shared Admin password. Admin is separate from User
login. Begin every repair by inspecting the numeric Track ID and checking its
normalized Picks, active Pick cycle, elimination, projections, eligibility,
inconsistencies, reactivations, and recent operations.

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

Confirm payment outside Loser League and reactivate the eliminated Track. The
server preserves its factual `WRONG_PICK`, including the used Team, but clears
the active elimination and records a durable reactivation linked to the
eliminating Pick and audit operation. Week 1 timing remains league-owner
guidance rather than a server restriction.

## NFL playoff Pick reset

At League Week 19, before any Week 19 Pick or automatic selection, type
`RESET PICKS FOR PLAYOFFS`. The operation advances the season to Pick cycle 2
and gives every Track—active or eliminated—a fresh Team pool. It does not
reactivate eliminated Tracks or erase factual Pick history.

This operation is league-wide and non-undoable. Once cycle 2 exists, do not
roll production back to code that is unaware of Pick cycles; deploy a forward
fix.

## Failure and recovery

Preview does not mutate data. Confirmation reloads and locks state; stale,
expired, replayed-with-different-state, or unsafe requests fail without a
partial change. Successful operations and sanitized before/after target states
are audited transactionally. Conditional undo for undoable repairs is part of
the next program PR; until then, do not attempt a raw database reversal.
