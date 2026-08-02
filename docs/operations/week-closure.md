# Weekly result processing and closure

Weekly result processing is server-owned. The League page may color terminal
Pick results, but it never eliminates Tracks, clears Picks, updates Team
records, or advances the League Season.

## Automatic operation

- Fixture Download defines the complete schedule and kickoff times for the
  active League Season year/week.
- The coordinator first checks ESPN about 2 hours 45 minutes after each
  kickoff. Overlapping expected-finish windows share one weekly check per
  minute.
- Suspended, postponed, or delayed games back off to five-minute checks and
  cause the Fixture schedule to refresh. A changed kickoff is accepted only
  when the matchup set remains identical.
- ESPN's explicit terminal status or a committed official-result override is
  required. Scores or elapsed time alone never make a game final.
- Startup catch-up and a five-minute recovery loop call the same evaluator as
  targeted timers.
- Targeted checks farther away than Node's maximum timer duration use bounded
  intermediate wake-ups rather than overflowing into immediate retries.
- Automatic closure waits for every scheduled game to be final.

Closure is one serializable transaction. It locks and revalidates the League
Season, schedule versions, `AUTO_PICK`, active Tracks, Picks, and the unique
`CLOSE_WEEK` marker. Selected losers survive; selected winners and either Team
in a tie receive a Wrong Pick. All processed legacy `current_pick` values are
cleared. Legacy used/available Picks and `Team.team_record` are not changed.

Weeks 1–21 advance once. Week 22 records `CLOSE_WEEK` but remains active at
Week 22 until explicit season completion.

## Shared-admin controls

The authenticated Admin page provides two registered actions:

- `OVERRIDE_GAME_RESULT` records one immutable result for an exact current
  Fixture matchup. Final scores and an explanation are required; an HTTP(S)
  source URL is optional. Exact repetition returns the original audit, while a
  conflicting result is rejected. Confirmation commits only the override and
  actorless audit, then requests evaluator rechecking.
- `CLOSE_WEEK` builds a fresh authoritative result context before preview and
  again before confirmation. It is available only after auto-pick and when
  every active Track's selected game is final. The preview lists unfinished
  unselected games. Confirmation requires a note and commits closure plus its
  actorless audit atomically.

Admin authority remains the shared `ADMIN_PASSWORD` session. An admin is never
a User and no actor identity is stored.

## Failure and recovery

Missing, duplicate, contradictory, malformed, or unmatched provider data
blocks closure without partial writes. Upstream failures are retried by the
coordinator and logged once by safe reason code. A late result cannot reopen a
closed week. Corrections to a committed override or closed week belong to the
later guided repair workflow.

After deployment, verify the migration is current, the exact release SHA is
active, startup has no `week_closure_blocked` configuration error, `/` and
`/api/nfl/teams` are healthy, and the Admin page shows both weekly lifecycle
actions. Do not preview or force a production closure merely as a health check.
