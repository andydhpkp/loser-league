# Admin access and winner records

Loser League administrators share a password but do not authenticate as Users.
The server reads `ADMIN_PASSWORD` from environment configuration, compares the
submitted value without exposing it to browser code, and grants an eight-hour
admin session.

## Access

1. Open the Admin modal on the home page.
2. Enter the shared password.
3. Successful authentication opens `/admin.html`.
4. Use the admin page Logout button to destroy the admin session.

An unauthenticated request for `/admin.html` redirects home. Every route under
`/api/admin/actions` verifies the shared-admin session before parsing targets or
performing lookups and returns HTTP 401 otherwise.

The Admin Guide on `/admin.html` is loaded from the authenticated action
registry. It lists every registered action's purpose, instructions, warnings,
and undo status; it does not advertise retained low-level emergency routes.

## Previewed admin actions

Current admin mutations include User/Track management, official-result and
week-closure controls, and guided Track repairs. The
admin page first creates a ten-minute persisted
preview, displays its generated description, affected count, and warnings, and
then confirms it with a one-use key. The server stores only a hash of that key.

Confirmation locks and reloads the target state. Expired, already-changed, or
wrong-action previews fail without mutation. A successful confirmation commits
the mutation and sanitized audit operation/target rows in one transaction.
Replaying the same successful confirmation returns the existing operation and
does not repeat the mutation.

Audit history has no actor field because Admin is not a User and the shared
password intentionally does not identify an individual. Audits exclude email,
password, session, request-body, and other unrelated account data. User and
Track deletion are permanent and non-undoable.

Official-result override requires final scores and an explanation; an HTTP(S)
source URL is optional. Manual closure requires a note and is offered only when
every active Track's selected game is authoritative and final. See
[`week-closure.md`](week-closure.md). Neither workflow uses User login.

## Complete and roll over a League Season

After a durable week closure and before the next week has any Pick or auto-pick
work, Admin enters every winning Track ID. The server verifies those Tracks,
deduplicates their owners, records one solo win for one unique winning User or
tied wins for multiple unique winning Users, and moves the season to
`COMPLETE` atomically. Multiple winning Tracks owned by one User still produce
one solo win.

Rollover then requires an explicitly typed four-digit target year; there is no
clock-derived default or automatic `+1`. Preview validates Week 1 with Fixture
Download and downloads a checksum-bound JSON file containing numeric ownership
and Track/Pick facts but no names, email, credentials, sessions, or secrets.
Only after that download does the normal Yes/No confirmation run.

Confirmation permanently deletes the outgoing season's Track-owned
reactivation rows, normalized Picks, and Tracks, preserves Users and wins plus
schedule, week-operation, official-result, and audit evidence, marks the old
season `ROLLED_OVER`, and creates the entered year in `SETUP`, Week 0, Pick
cycle 1. The transaction and one-use preview make replay safe. Recovery after
a successful rollover must use a forward application fix and the downloaded
export; old code must not be rolled back across this boundary.

## Guided Track repairs

The admin page inspector accepts a numeric Track ID and returns the owning
User's display name and username (never email), normalized Pick history and
Pick cycles, current projections, current scheduled eligibility,
inconsistencies, buyback reactivations, and recent audit operations.

The guided operations can reset, assign, or replace a current-week Pick and
reactivate an eliminated Track after external Week 1 buyback payment is
confirmed. Buyback preserves the factual Wrong Pick and its used Team. A reset
of every active Track requires the exact phrase `RESET EVERY TRACK`.

At Week 19, before any Week 19 Pick or auto-pick operation exists, Admin can
reset Team eligibility for every active and eliminated Track. This requires
`RESET PICKS FOR PLAYOFFS`, advances the League Season from Pick cycle 1 to
cycle 2, and is non-undoable. Once cycle 2 exists, cycle-unaware application
code is rollback-unsafe; recover with a forward fix.

See [`guided-admin-repairs.md`](guided-admin-repairs.md) for the runbook.
Historical correction, closed-week outcome reconciliation, deterministic Track
projection rebuild, and one-level conditional undo use the same preview,
stale-check, transactional audit, and shared-admin authorization boundary.

## Record a League Season win

1. Select the User's name on the admin page.
2. Review the existing win history and crown type.
3. Enter the explicit four-digit League Season year.
4. Choose “Add solo win” or “Add tied win.”
5. Verify the User, year, and win type in the confirmation prompt.

The previewed operation is idempotent for an already-recorded year. A tied submission can
upgrade a solo win for that year; it cannot be downgraded through this tool.
Removing or correcting a win requires a separately approved recovery process.

## Configuration and rotation

Set `ADMIN_PASSWORD` in the local ignored `.env` file for development and in
Heroku config for production. Never add the value to source, tests,
documentation, logs, command transcripts, or pull-request text.

Before a production merge, verify only that the Heroku config key exists. To
rotate access, replace the config value through authorized Heroku configuration
management and distribute it outside the application. Existing admin sessions
remain valid until logout or their eight-hour expiry.

The shared password is intentionally independent of User accounts. The admin
browser no longer uses general Track mutation routes for its registered
operations. Retained raw Track mutations remain callable for known owner repair
workflows, but now require the same admin session and transactionally write a
sanitized, actorless, non-undoable `LEGACY_EMERGENCY_REPAIR` audit. Their route
contracts are unchanged and their guided mappings are documented in the route
inventory.
