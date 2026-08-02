# Zero-Track onboarding

An authenticated User who owns no Tracks in the open League Season sees the
profile-page onboarding panel. Any owned Track, including an eliminated Track,
suppresses it. The server derives this state from the User session and current
League Season; browser IDs and local storage do not authorize or select it.

## Enrollment behavior

- Week 0 (`SETUP`) is open.
- Week 1 (`ACTIVE`) is open when the first kickoff is unknown or still in the
  future.
- Enrollment closes at a known first kickoff, after Week 1, or outside those
  League Season states.

Open enrollment shows the $5-per-Track instructions, valid payment/help
actions, and a notice that admins add Tracks manually after payment. Closed
enrollment omits payment and retains valid help contacts. **Refresh Tracks**
reloads authoritative state after an admin adds a Track; there is no polling.

The same policy protects the admin `CREATE_TRACK` preview and confirmation.
Confirmation rechecks the known kickoff boundary, so a preview created before
kickoff cannot create a Track after kickoff. A missing Week 1 schedule
intentionally defaults enrollment to open.

## Configuration

Set these keys in local ignored configuration and Heroku config:

- `ONBOARDING_TATE_PHONE`
- `ONBOARDING_ANDREW_PHONE`
- `ONBOARDING_VENMO_HANDLE`
- `ONBOARDING_VENMO_URL`

Phone values accept a ten-digit US number or `+1` number with common display
punctuation. Venmo requires a matching pair shaped as `@handle` and
`https://account.venmo.com/u/handle`. Track price is application policy: $5
USD per Track.

Never commit, document, log, or paste real phone values into issue/PR text.
Production verification checks key names only and does not retrieve values.

Invalid individual options are omitted. Startup logs one sanitized
`onboarding_configuration_invalid` warning containing only invalid key names.
If no valid action remains, the User receives a generic organizer-help message
without broken links.

## Privacy and security

Only `GET /api/user/league/submission` can return this presentation, after User
session authorization, and only for a zero-Track User. Public pages and
unauthenticated requests receive no contact configuration. The response
contains only display names, formatted public contact data, normalized `sms:`
links, and—while enrollment is open—the validated Venmo action. It contains no
payment status, User ID, credentials, sessions, or unrelated environment data.
