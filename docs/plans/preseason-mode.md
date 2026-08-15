# Change contract: Preseason mode

The rolling preseason deadline decision in this historical change contract is
superseded by [`fixed-preseason-pick-deadline.md`](fixed-preseason-pick-deadline.md).

## Problem and outcome

- Loser League is most safely exercised each year against live NFL preseason
  games, but its schedule and League Season lifecycle currently support only
  regular season and playoffs.
- A shared admin needs an explicit disposable preseason mode that exercises the
  real application workflows, plus an always-available cutover back to regular
  Week 1.
- The existing NFL schedule adapter maps Weeks 1-18 to ESPN regular-season data
  and the League Season model has no schedule-phase field.

## Scope

- In scope: preseason schedule access, inferred preseason-week activation,
  normal weekly progression, temporary Track data, destructive regular-season
  cutover, late Week 1 recovery, admin controls, tests, and documentation.
- Explicitly out of scope: retaining preseason gameplay history, changing User
  or winner history, automatic regular-season cutover, and changing normal
  regular-season weeks after Week 1.
- Affected workflows: every User and admin workflow that reads the active
  League Season schedule, creates Tracks, submits or assigns Picks, runs
  automatic Picks, settles results, or closes a week.

## Behavior

- A shared admin may enable preseason mode from SETUP Week 0 or ACTIVE regular
  Week 1 while no regular Week 1 game has started. Starting Week 1 first does
  not remove the option.
- Activation infers the earliest preseason week with at least one unfinished
  game. It is blocked when all preseason games are complete.
- Activation permanently deletes all current-season Tracks and their dependent
  gameplay data, then activates the inferred preseason week.
- Preseason weeks are separate rounds and otherwise use the same registration,
  Track, Pick, automatic-Pick, outcome, elimination, closure, repair, buyback,
  page, and admin workflows as regular weeks.
- Games already started remain visible but cannot receive new Picks. When a
  week is opened late, its Pick/automatic-Pick deadline is the earliest
  remaining kickoff. Automatic Pick remains one-time; Tracks created after it
  runs require a User or admin Pick.
- Closing a preseason week advances to the earliest later preseason week with
  unfinished games, skipping fully completed weeks. After the last week, the
  League Season waits in a preseason-complete state.
- The admin always sees a **Start Regular Season** action while in preseason.
  It may be confirmed during an unfinished preseason week and after regular
  Week 1 has begun. It permanently deletes all preseason Tracks and gameplay
  data and activates regular Week 1.
- After a late cutover, Track creation remains open through regular Week 1.
  Started games are visible but unavailable; remaining games may receive Picks.
- Before regular Week 1 begins, an admin may re-enter preseason if unfinished
  preseason games remain. Once any regular Week 1 game starts, preseason cannot
  be re-enabled for that League Season.
- No destructive transition happens automatically. Both transitions use a
  preview and explicit confirmation.

## Interfaces and data

- Extend the authenticated admin action preview/confirm interface with
  `ENABLE_PRESEASON` and `START_REGULAR_SEASON`.
- Extend the NFL schedule interface with an explicit preseason/regular phase;
  preserve existing callers by retaining regular season as the default where
  compatibility requires it.
- Add a forward-only League Season migration for its current schedule phase and
  any lifecycle marker needed to distinguish preseason completion and late
  Week 1 enrollment.
- Schedule snapshots and weekly operations must distinguish preseason from
  regular Week 1 so their uniqueness and evidence cannot collide.
- User identities and win history remain unchanged. Preseason gameplay data is
  disposable. Minimal aggregate admin audit records remain under the existing
  admin-action contract.

## Design

- Keep schedule-phase selection in NFL adapters and deterministic lifecycle
  policy modules, not Express or browser modules.
- Keep destructive multi-table transitions in one database transaction behind
  the existing registered admin preview/confirm service.
- Keep page event binding in the admin page entry/workflow module and expose
  phase through existing League Season context responses.
- Prefer extending the existing League Season, Pick, schedule-snapshot, and
  weekly-operation contracts over creating a parallel preseason application.
- No ADR is expected unless implementation reveals a hard-to-reverse lifecycle
  boundary not captured here.

## Safety and delivery

- Both actions require the existing shared-admin session, one-use persisted
  previews, stale-state revalidation, and explicit destructive warnings.
- Confirmation locks the League Season and revalidates schedule/game timing
  before deleting anything.
- Deletions are constrained to the exact open League Season; Users and winner
  records are never targets.
- Logs and audits contain only phase, year/week, and aggregate counts—never
  credentials, request bodies, personal data, or Pick details.
- Rollback removes the UI/actions and returns schedule reads to regular mode.
  Already deleted temporary Tracks are intentionally unrecoverable; the preview
  makes that explicit.

## Verification

- Unit tests: schedule query/client phase mapping, inferred-week policy,
  started-game eligibility/deadlines, admin registry/service intent, browser
  controls, enrollment exception, and phase-aware weekly advancement.
- Integration tests: authorized preview/confirm, unauthorized rejection,
  transactionally scoped deletions, re-entry boundary, midweek cutover,
  preseason completion, phase-distinct persistence, and late Week 1 Track/Pick
  creation against a disposable test database.
- Browser smoke tests: enable-preseason preview/confirm, phase/week rendering,
  disabled started games, and always-visible regular-season cutover.
- Run all checks required by `docs/engineering/README.md` before any pull
  request. Database checks require a disposable `TEST_DATABASE_URL` containing
  `test`.

## Decisions and open questions

- Resolved: inferred earliest unfinished preseason week; distinct weekly
  rounds; normal flows; permanent Track deletion on both transitions; visible
  but disabled started games; one-time auto-pick at earliest remaining kickoff;
  manual handling for later Tracks; explicit midweek/late cutover; late Week 1
  enrollment; no automatic cutover; minimal audit retention.
- Open questions: none.
- External dependency: ESPN preseason scoreboard availability and semantics
  must be verified through adapter tests and a safe read-only probe if needed.

## Completion

- Update route contracts, architecture/behavior documentation, NFL data
  documentation, and League Season/admin operations guidance.
- Residual risk: upstream preseason coverage and game-status timing can vary;
  fail closed when schedule evidence is missing or invalid.
- Next safe step: add failing policy, route, model, and admin-action tests.
