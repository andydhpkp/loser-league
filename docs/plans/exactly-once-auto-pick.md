# Change contract: Exactly-once automatic Picks

Confirmed: 2026-08-01

## Problem and outcome

- Browser code currently initiates league-wide automatic Picks using a
  hard-coded Thursday time, localStorage, `Math.random`, and process-memory
  cooldowns. Those mechanisms are neither schedule-aware nor durable across
  tabs, restarts, deployments, and multiple server processes.
- At the earliest validated kickoff for the server-authoritative League
  Season/week, close User submission and atomically assign one independent
  random eligible Pick to every active Track still missing one.

## Scope

- In scope:
  - Validated Fixture Download deadlines and schedule refresh.
  - Server-owned exact-deadline timer, startup catch-up, and periodic recovery.
  - Exactly-once transactional auto-pick using the existing durable
    `LeagueWeekOperation` `AUTO_PICK` phase.
  - Independent cryptographically secure selection for every missing Track.
  - Safe auto-pick status in the authenticated submission-state response.
  - Removal of browser scheduling and the public legacy force-pick endpoint.
- Explicitly out of scope:
  - Result reconciliation, Wrong Picks, week advancement, guided repairs,
    admin undo, season completion, or rollover.
  - A manual deadline or auto-pick override.
  - A browser/page-request lifecycle evaluation endpoint.
  - Any relationship between the shared-password admin and a User.
- Affected workflows: final User submission, automatic Picks, process startup,
  schedule refresh, league visibility, and post-deadline pending status.

## Behavior

- Filter Fixture Download to the active League Season year/week. Parse every
  kickoff as UTC; the earliest kickoff is the submission deadline.
- Exact duplicate games with identical Teams and kickoff are deduplicated.
  The same matchup with different kickoffs, or one Team in multiple weekly
  games, blocks evaluation. Multiple games sharing the earliest kickoff are
  valid.
- Refresh schedule every five minutes before the final 15 minutes, then every
  30 seconds until the deadline. Legitimate refreshes reschedule the exact
  timer. Fixture Download requests time out after 10 seconds.
- A User submission must acquire the League Season lock and find locked server
  time strictly before the refreshed deadline. At or after the deadline it
  fails even when auto-pick is delayed or blocked.
- Auto-pick acquires the same lock and commits only when locked server time is
  at or after the deadline. Request arrival order does not decide the race.
- Target only active Tracks in the active League Season with no normalized
  current-week Pick. Submitted and eliminated Tracks remain unchanged.
- Derive each Track's eligible set independently from scheduled Teams minus its
  prior normalized Picks. Verify legacy Track projections agree before writing;
  any mismatch, malformed state, or exhausted eligible set rolls back all
  Tracks and leaves `AUTO_PICK` uncommitted.
- Production selects independently for each Track with `crypto.randomInt`.
  Different Tracks may select the same Team. Tests inject deterministic draws.
- One successful serializable transaction creates normalized Picks, updates
  legacy Track projections, persists schedule evidence, and creates the unique
  `AUTO_PICK` operation. A successful all-submitted/no-target evaluation still
  records completion.
- Repeated or concurrent evaluation after success returns a no-op. Auto-pick
  never reruns after an admin reset; post-deadline gaps require guided repair.
- Blocked evaluations retry every 30 seconds. Log one sanitized warning when
  the blocked reason changes and a sanitized success summary; never log User
  identity, Track Picks, request bodies, credentials, or personal data.

## Interfaces and data

- Extend the authenticated submission-state response with:
  - `deadline`;
  - `submissionOpen`;
  - `autoPickStatus`: `NOT_DUE`, `PENDING`, `COMPLETED`, or `BLOCKED`;
  - a generic safe message only when pending or blocked.
- No lifecycle input is accepted from a browser or User request.
- Reuse `ScheduleSnapshot` for immutable normalized schedule/hash evidence.
- Reuse the existing unique `(league_season_id, week, phase)`
  `LeagueWeekOperation` row with phase `AUTO_PICK`; no new execution table or
  schema migration is required unless implementation evidence disproves this.
- Auto-generated Picks use origin `AUTOMATIC_SELECTION` and the validated
  schedule hash. Normalized Picks remain authoritative; legacy Track fields are
  compatibility projections through #11.

## Design

- Pure weekly rules own schedule validation, deadline comparison, eligible-set
  validation, and deterministic selection planning.
- An application service owns fresh schedule acquisition, serializable
  transaction boundaries, League Season/Track locks, Pick/projection writes,
  durable completion, retries, and safe operation results. It imports no
  Express or browser code.
- A lifecycle coordinator owns the exact timer, schedule-refresh cadence,
  startup catch-up, and 30-second recovery evaluation. It starts separately
  from application creation after database verification.
- Every web process may evaluate. Database locks and the unique operation row
  select one winner; no leader election or process-memory execution proof is
  introduced.
- Web startup becomes available after database verification and launches
  catch-up asynchronously. Temporary schedule failure does not prevent startup
  and never reopens submission.

## Safety and delivery

- Schedule, year, week, target Tracks, eligible Teams, deadline, and Picks are
  server-derived. Browser clocks, localStorage, Track ordering, and User input
  have no authority.
- Upstream failure, Week 0, missing/invalid active season, contradictory data,
  invalid clock, conflicting lifecycle work, Track inconsistency, or write
  failure changes nothing and records no completion.
- The current schema already supports additive rollout. The prior application
  ignores any `AUTO_PICK` row produced by the new release. Rolling application
  code back after success cannot safely rerun the legacy force-pick endpoint,
  so production verification precedes any decision to roll back.
- Delete the legacy endpoint and browser scheduler only after replacement tests
  and reference searches prove them superseded.

## Verification

- Confirmed public test seams from issue #19 and the final contract:
  - pure weekly-rule and selection-planning functions;
  - lifecycle application service and coordinator interfaces;
  - authenticated submission-state HTTP response;
  - disposable-MySQL transaction, uniqueness, rollback, retry, restart, and
    submission-race behavior;
  - profile/league page-entry behavior without browser lifecycle authority.
- Work in vertical red-green slices with controlled clocks, fake Fixture
  Download responses, injected deterministic randomness, and disposable MySQL.
- Cover deadline weekdays/boundaries/changes, duplicate contradictions,
  one/many/no target Tracks, submitted/eliminated Tracks, projection mismatch,
  independent draws, mid-write rollback, retry/no-op, concurrent evaluators,
  restart catch-up, and User-submission races.
- Run unit, unit coverage, browser lint, disposable-MySQL integration, browser
  smoke, and `git diff --check` before publication.

## Decisions and open questions

- Resolved:
  - Recovery interval is 30 seconds.
  - Refresh schedule every five minutes, then every 30 seconds in the final 15
    minutes.
  - Omit the page-request fallback and any manual auto-pick override.
  - Use database serialization across every web process without leader
    election.
  - Startup catch-up is asynchronous after database verification.
  - Blocked reason changes are logged once and presented generically to Users.
  - Legacy projection mismatch blocks rather than silently repairing state.
  - Remove the legacy public endpoint and browser scheduler.
- Open questions: none.

## Completion

- Implementation and the complete local PR gate passed on 2026-08-01:
  - `npm run test:unit` — 93 passed;
  - `npm run test:unit:coverage` — 93 passed, 82.42% line coverage;
  - `npm run lint:browser` — passed;
  - `npm run test:integration` — 17 passed against disposable MySQL;
  - `npm run test:smoke` — 7 passed;
  - `git diff --check` — passed.
- Update issue #19 and add PR/deployment evidence after publication and merge.
- Residual risk: result processing remains browser/projection based until #11.
- Next safe step: merge, verify automatic Heroku release and production health,
  then begin #11 from fresh `main`.
