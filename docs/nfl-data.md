# NFL data interfaces

This document defines the current browser and server interfaces for public NFL
data. Historical proxy behavior remains documented under `docs/refactor/`.

## Behavior and routes

The browser reads ESPN NFL data only through these public, same-origin routes:

| Route | Upstream | Response |
| --- | --- | --- |
| `GET /api/nfl/teams` | ESPN NFL Teams | Upstream JSON unchanged |
| `GET /api/nfl/schedule?year=<year>&week=<week>` | ESPN NFL Scoreboard | Normalized schedule JSON |

Schedule requests may add `seasonType=preseason`. Preseason maps to ESPN season
type 1; omitting the parameter preserves the regular/postseason behavior.

The Schedule route accepts one canonical integer `year` from 2000 through the
server's current UTC year plus one and one canonical integer `week` from 1
through 22. Invalid or repeated values return `400 VALIDATION_ERROR`.

The Schedule response preserves `content.schedule[date].games` for browser
consumers. The server builds that shape from ESPN scoreboard events. League
Season weeks 1–18 map to ESPN regular-season weeks; weeks 19–22 map to ESPN
postseason weeks 1–4.

The active League Season's schedule phase is authoritative for Picks,
automatic Picks, results, and closure. In a preseason or late-cutover round,
games already underway remain in the response for display and results, but
only Teams with a future kickoff are eligible for a new Pick. The deadline is
the earliest remaining kickoff.

`GET /api/proxy/nfl` is the browser's Fixture Download feed. It
resolves the stored open League Season year on the server; the browser cannot
choose or infer that year. The fixed-year compatibility route was removed after
reference searches proved it unused. Server lifecycle modules likewise fetch
the Fixture feed for the stored League Season year and persist validated
schedule snapshots.

Weekly closure matches the complete Fixture schedule to ESPN by both Teams,
not array position. Only ESPN explicit terminal status supplies a normal
result. Kickoff times schedule polling near expected finishes but never imply
completion. Missing or contradictory games fail closed; committed immutable
shared-admin overrides may supply a terminal result for one exact matchup.

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
status checks, JSON parsing, and schedule normalization. The server isolates
ESPN's scoreboard shape from the existing browser rendering contract.

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
## Calendar season-schedule seam

The hidden Pick deadline calendar needs future rounds without changing the current-round lifecycle contract. Its dedicated loader fetches Fixture Download's annual response once, partitions rounds 1–18 as regular season and 19–22 as playoffs, then applies the same normalized game, duplicate, Team-reuse, timestamp, and earliest-kickoff rules independently per round. Preseason uses the existing ESPN scoreboard seam for weeks 1–4. One invalid future round is omitted/cancelled without discarding other trustworthy rounds; transport failure preserves the entire last trustworthy calendar. Automated tests inject provider responses and never contact either service.
