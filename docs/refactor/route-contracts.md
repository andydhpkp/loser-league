# Route contracts

All routes are mounted under `/api` unless stated otherwise. Existing successful
status codes and bodies are compatibility constraints.

## Shared Pick deadline calendar

Public `GET /calendar/pick-deadlines.ics` requires no session or token and returns the shared cross-season iCalendar representation with five-minute public caching, strong ETag, Last-Modified, and conditional 304 support. Query parameters and request Host never select its content. Unsupported methods use the existing not-found convention.

Hidden `GET /api/user/reminders/calendar` requires a User session and effective Pick Reminders access and is `private, no-store`. It returns only `state`, canonical `subscriptionUrl`, safe `webcalUrl`, `subscriptionState: "LINK_PROVIDED"`, and `subscriptionCompletionDetectable: false`. It never returns a User token or claims an external subscription is enabled.

## Hidden Pick Reminders push (`/api/user/reminders/push`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/configuration` | Safe operational state and public VAPID key when ready. |
| POST | `/status` | Current-device state from an exact HTTPS endpoint plus aggregate count. |
| PUT | `/subscription` | Register/update the authenticated User's encrypted device. |
| DELETE | `/subscription` | Disable only the matching current device. |
| DELETE | `/subscriptions` | Disable all devices and the push preference. |

The routes require a User session and effective access, never accept a User ID, set `private, no-store`, and never return subscription or storage material.

## Hidden Pick Reminders email (`/api/user/reminders/email`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | Safe state and masked current account destination. |
| POST | `/verification-requests` | Request ownership verification; body is exactly `{}`. |
| POST | `/enable` | Immediately enable unchanged verified email; body is exactly `{}`. |
| POST | `/disable` | Disable email only while preserving verification; body is exactly `{}`. |

These routes require the User session and effective access, derive the User and destination server-side, and set `private, no-store`. The request route returns HTTP 202 pending or HTTP 429 with persisted `Retry-After`; it never exposes counters or provider details. Status returns only a masked destination and the documented safe state.

Public `GET /reminders/email/verify?token=...` verifies and enables atomically or shows one neutral unavailable state. Public `GET /reminders/email/stop?token=...` idempotently shows **Email reminders are off.** Both set `no-store` and `Referrer-Policy: no-referrer`, expose no identity or League facts, and never log the query token.

## Users (`/api/users`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | List users with associated tracks. |
| GET | `/:id` | Fetch one user by ID. |
| GET | `/username/:username` | Fetch one user by username. |
| POST | `/` | Register a user. |
| POST | `/login` | Authenticate and establish a session. |
| GET | `/logged` | Report session login state. |
| POST | `/logout` | Destroy the session. |
| PUT | `/:id` | Update a user. |
| DELETE | `/:id` | Delete a user. |
| DELETE | `/username/:username` | Delete a user by username. |
| POST | `/reset-password` | Reset a password by email. |
| PUT | `/:id/add-win` | Add a season win record. |
| GET | `/:id/wins` | Return win totals. |

Browser callers: login, logout, registration, password reset, admin, profile,
and standings page modules.

## Authenticated User home

`/dashboard.html` and `/help.html` require a valid User session and redirect
unauthenticated requests to `/index.html`. Successful login and registration
navigate to the dashboard. Authenticated page headers and explicit Home
actions return there; direct `/profile.html` and `/league-page.html` links
remain compatible.

`GET /api/user/dashboard` requires the User session, returns `private,
no-store`, and exposes only the active League Season year/week/state,
authoritative deadline availability/timestamp, the User's active and
missing-Pick counts, a server-computed Make Picks code/label, and feature
capabilities. It never returns Track details, other Users, Picks, contact data,
session state, or admin state. `features.pickReminders` is server-computed from
validated system availability and durable beta/public-release state. PR 1
shows only a disabled **Pick Reminder Settings** label to effective-access
Users; all reminder settings and Help copy remain unavailable.

`GET /api/admin/features` requires the shared-admin session and exposes only
the Pick Reminders public-release boolean and state version. The User workspace
adds only Pick Reminders Beta Access and its state version. The registered
access/release mutations use the existing preview/confirm contract and
actorless sanitized audit.

## Teams (`/api/teams`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | List teams. |
| GET | `/:id` | Fetch a team by ID. |
| GET | `/team/:team_name` | Fetch a team by name. |
| POST | `/` | Create a team. |
| PUT | `/:id` | Update a team by ID. |
| PUT | `/team/:team_name` | Update a team by name. |
| DELETE | `/:id` | Delete a team by ID. |
| DELETE | `/` | Delete all teams. |
| PUT | `/reset-records` | Reset all team records. |

Static/named paths must be registered before `/:id` so they are reachable.

## Tracks (`/api/tracks`)

### Basic access

`GET /`, `GET /alive`, `GET /wrong-pick-not-null`,
`GET /wrong-pick-not-null/:userId`, `GET /:id`, `POST /`, `PUT /:id`,
`DELETE /:id`, and `GET /user/:userId/alive`.

### Pick lifecycle

`PUT /:id/loser`, `PUT /quick-replace/:trackId`,
`PUT /add-placeholder/:trackId`, `PUT /remove-placeholder/:trackId`,
`PUT /update-recent-pick-remove-and-add/:trackId`,
`PUT /remove-excess-used-picks/:limit`,
`PUT /remove-last-used-pick/:trackId`,
`PUT /add-to-available-picks/:trackId`,
`PUT /add-to-used-picks/:trackId`, and `PUT /reset-picks/:trackId`.

### Weekly and forced-pick maintenance

`PUT /all-tracks/reset-current-pick`,
`GET /all-tracks/alive-without-pick`,
`PUT /reset-to-pick-count/:pickCount`, and
`PUT /fix-current-pick/:length`.

### Repair operations

`PUT /reset-wrong-pick/:trackId`,
`DELETE /clear-memory/delete-wrong-pick`,
`PUT /user/:userId/reset-current-picks`,
`PUT /user/:userId/move-last-used-to-available`,
`PUT /reduce-used-picks/:trackId/:targetLength`,
`PUT /reduce-all-used-picks/:targetLength`,
`PUT /fix-wrong-pick/:minLength`,
`PUT /bug-fix/set-wrong-pick-for-teams`, and
`PUT /bug-fix/clear-wrong-pick-if-matches/:length`.

## Other routes

- `GET /api/proxy/nfl-2025`: proxies the external NFL fixture feed.
- `GET /api/proxy/nfl-odds`: proxies NFL spread data using the server-only
  `ODDS_API_KEY`.
- Static files are served from `public/`.

## Shared-admin lifecycle actions

`GET /api/admin/actions`, `POST /api/admin/actions/:action/preview`, and
`POST /api/admin/actions/:action/confirm` require the shared-admin session.
`CREATE_LEAGUE_SEASON` creates an explicitly entered year as SETUP Week 0 only
when no open season or unassigned legacy Tracks exist. `START_LEAGUE_SEASON`
requires that same year at SETUP Week 0 plus revalidated future Week 1 Fixture
evidence, persists its schedule, and activates Week 1 transactionally.
`ENABLE_PRESEASON` infers the earliest unfinished preseason week and
transactionally deletes current-season Tracks and disposable gameplay data
before activation. `START_REGULAR_SEASON` remains available throughout
preseason and transactionally deletes temporary Tracks/gameplay data before
activating regular Week 1. Both preserve Users and winner history and require
one-use destructive previews.

`GET /api/admin/league-season` requires the shared-admin session and returns
the current open League Season, or the latest completed season awaiting
rollover, plus the count of unassigned legacy Tracks. It does not fetch an
external schedule.
Registered guided repairs use the same preview/confirm protocol. Confirmation
accepts the one-use `confirmationKey` and, where required, an exact
`confirmationPhrase`. `GET /api/admin/repairs/tracks/:trackId` is an
authenticated, read-only Track inspector that excludes User email and
credentials. `GET /api/admin/users/:userId/workspace` is an authenticated,
read-only aggregate returning a sanitized User summary and ordered
current-season Track inspection views.
The registry includes `OVERRIDE_GAME_RESULT` and `CLOSE_WEEK`.

`SEND_PICK_REMINDERS` uses the same preview and confirmation routes and accepts
an empty JSON object only. The server chooses the current open League Season,
schedule phase, round, authoritative deadline, eligible Users, and all enabled
email/push channels. Preview returns aggregate channel counts and sanitized
proximity warnings only. Confirmation returns the committed actorless audit
operation and aggregate campaign summary; it never returns recipients,
destinations, Picks, Teams, message content, or raw delivery records. The action
is unavailable unless the master and manual-campaign operational controls are
true. PR 2 adds no User settings route and keeps the dashboard action disabled.

`GET /api/admin/reminders` requires the shared-admin session and returns only
active/previous-League-Season aggregate counts for evaluated, eligible, claimed,
accepted, unknown, temporary/permanent failure, suppressed, and retry-exhausted
delivery state, plus aggregate email verification-result counts, verified count,
and safe Gmail breaker/readiness state. It returns no campaign rows, identities,
destinations, or content.

`OVERRIDE_GAME_RESULT` preview accepts the exact current Fixture home/away
Teams, non-negative final scores, required explanation, and optional HTTP(S)
source URL. `CLOSE_WEEK` preview accepts no authoritative result input; the
server rebuilds it from Fixture, ESPN, stored overrides, `AUTO_PICK`, active
Tracks, and Picks. Its confirmation requires `note`.

The League-page browser no longer calls `PUT /:id/loser`, Team record writes,
or `PUT /all-tracks/reset-current-pick`. Every retained raw Track mutation
requires the shared-admin session before lookup, executes its mutation and a
sanitized non-undoable `LEGACY_EMERGENCY_REPAIR` operation plus changed-Track
target states in one transaction, and
preserves its existing method, path, input, and success response. These routes
are deliberately absent from the browser Admin Guide and remain available for
the owner's known emergency workflows until final cleanup proves each guided
replacement.

### Retained raw mutation mapping

| Raw capability | Guided/server-authoritative replacement |
| --- | --- |
| `PUT /:id`, `/quick-replace/:trackId` | `ASSIGN_CURRENT_PICK` or `REPLACE_CURRENT_PICK` |
| `PUT /:id/loser` | authoritative automatic/manual `CLOSE_WEEK` or `RECONCILE_PICK_OUTCOME` |
| `PUT /all-tracks/reset-current-pick`, `/user/:userId/reset-current-picks` | selected/all `RESET_CURRENT_PICKS` |
| `DELETE /:id`, `DELETE /clear-memory/delete-wrong-pick` | previewed `DELETE_TRACK` for each intended Track |
| Placeholder add/remove and `/reset-picks/:trackId` | normalized Pick history plus `RESET_PLAYOFF_PICK_POOLS`; repair projections with `REBUILD_TRACK_PROJECTIONS` |
| Recent/last/excess/reduced used-Pick mutations, including user/all variants | `CORRECT_HISTORICAL_PICK`, selected/all `RESET_CURRENT_PICKS`, then `REBUILD_TRACK_PROJECTIONS` |
| Add-to-used/available projection mutations | `ASSIGN_CURRENT_PICK`, `REPLACE_CURRENT_PICK`, or `REBUILD_TRACK_PROJECTIONS` |
| `/fix-current-pick/:length` | `REBUILD_TRACK_PROJECTIONS` or `ASSIGN_CURRENT_PICK` |
| Wrong-Pick set/fix/clear/reset mutations | `RECONCILE_PICK_OUTCOME`, `REACTIVATE_TRACK`, or `REBUILD_TRACK_PROJECTIONS` |

The mapping describes the authoritative outcome, not a promise that arbitrary
legacy array corruption remains valid domain state. Raw routes are retained in
PR 6C; deletion decisions belong to final cleanup after reference and
replacement verification.

## Week 2 buyback

All User responses are authenticated and `private, no-store`:

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/user/league/buyback/request` | Create or exactly replay one immutable selected-Track request using the server state version. |
| POST | `/api/user/league/buyback/decline` | Durably decline or exactly replay the season offer. |

`GET /api/user/league/submission` includes a sanitized `buyback` view when a
decision applies and may wake the shared deadline evaluator before returning.
The submission route returns `409` while buyback state blocks Picks.

Shared-admin routes under `/api/admin/buybacks` require authorization before
lookup: `GET /` lists pending, eligible, or history views;
`POST /:decisionId/complete` completes an exact paid subset;
`POST /:decisionId/cancel` closes without fulfillment; and
`POST /direct/complete` performs direct eligible-Track completion. Responses
omit email, sessions, configuration values, and payment details.

## Error contract

Newly centralized failures use:

```json
{
  "error": "STABLE_ERROR_CODE",
  "message": "Safe human-readable description"
}
```

The browser must use status and error code rather than parse stack traces.
