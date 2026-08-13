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
- A server-owned weekly closure coordinator uses Fixture kickoff times to
  schedule targeted ESPN checks, with startup catch-up and periodic recovery.
  Pure reconciliation rules feed one serializable, exactly-once closure
  service. Automatic and shared-admin closure compete for the same durable
  `CLOSE_WEEK` marker.
- Immutable official-result overrides are registered shared-admin actions
  bound to a schedule hash and actorless audit. Manual closure rebuilds its
  authoritative result context before preview and confirmation.
- Shared-admin action routes adapt HTTP to a registry-backed application
  service. The service persists hashed, expiring previews and commits
  stale-checked mutations with append-only operation/target audits in one
  transaction. Admin authority remains a shared session and has no User or
  actor association.
- Guided admin repairs add an authenticated read-only Track inspector and
  registered current-Pick, buyback, and playoff reset actions. Pick-cycle
  identity belongs to League Season/Pick persistence; normal submission and
  auto-pick services consume the active cycle, while Track arrays remain
  current-cycle compatibility projections.
- Historical admin repairs obtain final result evidence before opening their
  mutation transaction, then revalidate schedule hashes and locked target
  state. Projection derivation is pure; conditional undo restores recorded
  business state only when every target still matches, while advancing state
  versions to prevent stale-state ABA.
- Week 2 buyback uses one season/User decision aggregate with immutable Track
  membership rows. Its application service owns eligibility, User/admin
  transitions, reactivation/audit writes, versions, and locks. Final submission
  calls its gate inside the League Season transaction; auto-pick expires
  unanswered and pending decisions before selecting newly active Tracks.
- Retained raw Track mutation adapters share an early admin boundary and a
  transaction wrapper. A successful legacy mutation is not returned until its
  sanitized actorless `LEGACY_EMERGENCY_REPAIR` operation and changed-Track
  target states commit; an error or audit failure rolls back the mutation. Their
  low-level response contracts remain
  compatibility adapters and are not action-registry guide entries.
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

- Page entries exist for home, registration, authenticated dashboard, User
  Help, profile, league, and admin.
- The authenticated dashboard consumes a minimal server-authoritative summary.
  Its browser entry formats the authoritative deadline for local display but
  does not infer Pick, buyback, deadline, or League Season rules.
- A narrow feature-access module combines validated fail-closed system
  availability with durable public-release/per-User entitlement state. Its
  access-state table records the 30-day removal grace window without storing
  reminder consent or channel data.
- A provider-neutral reminder module owns pure eligibility, fixed campaign
  identity, preferences, transactional outbox claims, bounded retry,
  suppression, cleanup, and minimal provider intents. Startup composes its
  coordinator; Express and provider adapters do not enter reminder policy.
- The profile entry renders an accessible buyback modal from sanitized
  submission state. Browser dismissal and disabled controls are presentation;
  server identity, eligibility, price, deadline, and Pick gating are authority.
- Reusable modules own admin management, track actions, league rendering,
  profile navigation, team results, team catalog data, auto-pick scheduling,
  weekly statistics, and browser logging.
- The admin User workspace uses one targeted authenticated aggregate read and
  reconciles successful per-User mutations from that server-authoritative view
  while preserving User and applicable Track selection.
- League result rendering is read-only and receives the server-authoritative
  League Season year/week. It never owns Track, Pick, Team, or week mutations.
- `app.js` is a compatibility re-export rather than a shared implementation.
- Pages import only their entry module. No active behavior depends on global
  function declaration order or inline event attributes.
