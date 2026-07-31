# NFL data interfaces

This document defines the current browser and server interfaces for public NFL
data. Historical proxy behavior remains documented under `docs/refactor/`.

## Behavior and routes

The browser reads ESPN NFL data only through these public, same-origin routes:

| Route | Upstream | Response |
| --- | --- | --- |
| `GET /api/nfl/teams` | ESPN NFL Teams | Upstream JSON unchanged |
| `GET /api/nfl/schedule?year=<year>&week=<week>` | ESPN NFL Schedule | Upstream JSON unchanged |

The Schedule route accepts one canonical integer `year` from 2000 through the
server's current UTC year plus one and one canonical integer `week` from 1
through 22. Invalid or repeated values return `400 VALIDATION_ERROR`.

The existing `GET /api/proxy/nfl-2025` Fixture Download route remains the
source for the 2025 fixture feed. It is intentionally separate from the ESPN
routes.

## Architecture

```text
browser page modules
  -> public/js/modules/nfl-data.js
    -> /api/nfl routes
      -> server/nfl/espn-client.js
        -> fixed ESPN hosts and paths
```

Browser code cannot select an upstream host or path. The NFL router validates
HTTP input; the ESPN client owns approved URLs, timeout behavior, upstream
status checks, and JSON parsing. ESPN response shapes remain external
contracts consumed by the existing browser rendering code.

## Failures and safety

- ESPN calls time out after five seconds.
- The server does not automatically retry or retain an application-level
  response cache.
- Timeout, network failure, non-success status, and malformed JSON return the
  safe `502 UPSTREAM_ERROR` response without returning the upstream body or
  internal exception.
- The routes expose public NFL data and do not require authentication.
- No credential, arbitrary proxy target, User data, Track data, or request body
  is sent upstream.

## Operations

After deployment:

1. Request `/api/nfl/teams` and confirm an ESPN Teams payload is returned.
2. Request a supported `/api/nfl/schedule` year/week and confirm an ESPN
   Schedule payload is returned.
3. Load the Pick and league pages and confirm matchup, record, logo, odds, and
   result-color behavior still works.
4. Confirm browser network traffic contains no request to
   `pacific-anchorage-21728.herokuapp.com`.
5. Review safe `400` and `502` behavior without recording upstream bodies.

Keep the Pacific Anchorage Heroku app available during deployment and
verification. Disabling or deleting it is a separate operational change that
requires explicit approval after production traffic is confirmed migrated.

Rollback consists of deploying the previous Loser League application version;
the external proxy remains untouched by this change.
