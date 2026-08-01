# Automatic Pick operations

Automatic Picks are server-owned. Browser clocks, localStorage, page loads,
Users, and the shared admin do not choose the League Season, week, deadline,
target Tracks, or Teams.

## Normal operation

- Fixture Download supplies the active year/week schedule. The earliest
  validated UTC kickoff is the submission deadline.
- The server refreshes every five minutes, then every 30 seconds during the
  final 15 minutes. Each request has a 10-second timeout.
- Every web process starts an exact-deadline timer, an asynchronous startup
  catch-up, and a 30-second recovery evaluator.
- All evaluators call one serializable service. The locked League Season row
  and unique `AUTO_PICK` operation select one winner across processes.
- One successful transaction writes every missing normalized Pick, matching
  legacy Track projections, schedule evidence, and the completion operation.
  Existing Picks and eliminated Tracks are unchanged.

## Blocked evaluation

Schedule failure, contradictory schedule data, Week 0, an inconsistent Track
projection, no eligible Team, or a database failure changes no Picks and does
not record completion. Recovery retries automatically every 30 seconds.

Logs contain one sanitized `auto_pick_blocked` warning when the reason category
changes. They contain no User names, Track selections, request bodies,
credentials, sessions, or personal data. Users see only a generic pending or
temporarily unavailable message.

Do not attempt to wake auto-pick through an HTTP route; none exists. Do not
change the server clock or schedule evidence. Repair inconsistent Track state
through the guided shared-admin workflow. After repair, normal recovery retries
the operation automatically.

## Completion and repair

Successful evaluation records one `AUTO_PICK` phase for the League Season/week,
including when every active Track had already submitted. It never runs again
for that week. If an admin later removes or resets a Pick, use the guided
post-deadline replacement workflow; auto-pick intentionally remains complete.

## Deployment and rollback

Startup catch-up runs after database verification and does not block the web
process from becoming available. A temporary Fixture Download outage therefore
does not fail application startup, but submission remains fail-closed.

There is no new schema migration for this feature; it reuses the existing
`ScheduleSnapshot`, normalized `Pick`, and `LeagueWeekOperation` tables. After
merge, verify the exact tested SHA, successful Heroku release, and both standard
production health checks before proceeding to weekly closure work.
