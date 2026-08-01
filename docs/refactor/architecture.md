# Architecture

## Current state

- `server/index.js` creates the Express application, configures middleware,
  defines the NFL proxy, synchronizes Sequelize, and opens the listener.
- `controllers/api/*-routes.js` combine HTTP parsing, validation, database
  queries, league logic, error mapping, and logging.
- `controllers/api/tracks-routes.js` is more than 2,000 lines.
- Sequelize models import one global connection. Both `models/index.js` and
  `models/my-index.js` attempt to load models using incompatible approaches.
- Static pages load overlapping classic scripts into one global namespace.
- `app.js` and `teams.js` exceed 1,100 lines and contain duplicate global names.

## Implemented dependency direction

```text
server/index.js
  -> createApp()
    -> HTTP route adapters
      -> user/team/track/auto-pick modules
        -> Sequelize models and transactions

page HTML
  -> one page entry module
    -> browser league/auth modules
      -> shared HTTP client
```

Dependencies point inward from transport adapters to deep modules. League logic
does not import Express or manipulate the DOM. Page entry modules own DOM event
binding. The shared HTTP client owns request/error normalization.

## Server modules

- `server/app.js` creates the Express application; `server/index.js` owns the
  listener lifecycle. The web process verifies database connectivity but never
  synchronizes shared schema. Heroku's release phase applies reviewed forward
  migrations first.
- League Season and normalized Pick models provide durable year/week, ordered
  weekly Pick, elimination, schedule-version, and exactly-once lifecycle seams.
  Existing Track Pick fields remain compatibility projections during the
  expand/backfill phase.
- Track routes are grouped into access, pick lifecycle, force-pick,
  maintenance, and repair modules behind the unchanged route entry point.
- Pure pick-state transitions live behind `makePick` and
  `replaceCurrentPick`.
- `models/index.js` and `models/my-index.js` now share one model graph rather
  than constructing incompatible graphs.
- Error middleware maps uncaught application errors to HTTP.
- One structured logger owns redaction, levels, and output shape.
- External NFL odds are fetched by a server proxy so `ODDS_API_KEY` is never
  shipped in browser assets.

## Browser modules

- Page entries exist for home, registration, profile, league, and admin.
- Reusable modules own admin management, track actions, league rendering,
  profile navigation, team results, team catalog data, auto-pick scheduling,
  weekly statistics, and browser logging.
- `app.js` is a compatibility re-export rather than a shared implementation.
- Pages import only their entry module. No active behavior depends on global
  function declaration order or inline event attributes.
