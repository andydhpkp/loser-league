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

An unauthenticated request for `/admin.html` redirects home. Unauthorized
requests to record a win return HTTP 401.

## Record a League Season win

1. Select the User's name on the admin page.
2. Review the existing win history and crown type.
3. Enter the explicit four-digit League Season year.
4. Choose “Add solo win” or “Add tied win.”
5. Verify the User, year, and win type in the confirmation prompt.

The operation is idempotent for an already-recorded year. A tied submission can
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

The shared password is intentionally independent of User accounts. Legacy User
and Track mutation routes do not yet have comprehensive ownership or admin
authorization; that remains separate security work.
