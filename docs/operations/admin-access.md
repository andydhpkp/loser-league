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

## Previewed admin actions

Current admin mutations are registered as add User win, create Track, delete
Track, delete User, official-result override, and manual week closure. The
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
browser no longer uses general User/Track mutation routes for its registered
operations. Those legacy routes remain during the expand phase for known User
and manual-repair consumers and are migrated or removed in later program PRs.
