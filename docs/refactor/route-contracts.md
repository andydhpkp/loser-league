# Route contracts

All routes are mounted under `/api` unless stated otherwise. Existing successful
status codes and bodies are compatibility constraints.

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
`GET /all-tracks/alive-without-pick`, `PUT /force-picks/all-alive`,
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
The registry includes `OVERRIDE_GAME_RESULT` and `CLOSE_WEEK`.

`OVERRIDE_GAME_RESULT` preview accepts the exact current Fixture home/away
Teams, non-negative final scores, required explanation, and optional HTTP(S)
source URL. `CLOSE_WEEK` preview accepts no authoritative result input; the
server rebuilds it from Fixture, ESPN, stored overrides, `AUTO_PICK`, active
Tracks, and Picks. Its confirmation requires `note`.

The League-page browser no longer calls `PUT /:id/loser`, Team record writes,
or `PUT /all-tracks/reset-current-pick`. Those raw routes remain available for
known manual repair workflows until the mapped-repair program replaces them.

## Error contract

Newly centralized failures use:

```json
{
  "error": "STABLE_ERROR_CODE",
  "message": "Safe human-readable description"
}
```

The browser must use status and error code rather than parse stack traces.
