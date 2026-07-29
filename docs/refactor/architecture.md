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

## Target dependency direction

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

## Planned server modules

- Application creation and startup are separate interfaces.
- User, team, track, and auto-pick modules own behavior behind small interfaces.
- Track internals are grouped into access, pick lifecycle, weekly maintenance,
  force-pick, and repair behavior without exposing those internal seams to
  callers.
- One model loader owns model initialization and associations.
- One error middleware maps application errors to HTTP.
- One logger owns redaction, levels, and output shape.

## Planned browser modules

- Page entries: home, registration, profile, league, and admin.
- Reusable behavior: HTTP client, authentication, users, tracks/picks,
  teams/schedule, week calculation, auto-pick scheduling, and DOM rendering.
- Pages import only what they execute. No behavior depends on global function
  declaration order.
