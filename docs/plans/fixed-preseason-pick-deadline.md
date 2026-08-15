# Change contract: Fixed preseason Pick deadline

## Problem and outcome

- Preseason schedule normalization and submission-state presentation currently
  advance the Pick deadline to the next unstarted game after an earlier game
  begins.
- Preseason must use the same fixed weekly deadline contract as normal rounds:
  the earliest kickoff in the complete validated weekly schedule.
- Issue #64 and the existing rolling-deadline unit coverage establish the
  current behavior.

## Scope

- In scope: preseason schedule normalization, Pick submission state,
  submission enforcement, one-time automatic-Pick timing, regression tests,
  and preseason/automatic-Pick operations documentation.
- Explicitly out of scope: regular-season late Week 1 enrollment, preseason
  week selection and advancement, buyback deadlines, schema changes, route or
  response-shape changes, and changes to Pick eligibility after a game starts.
- Affected workflows: preseason Pick display and submission, late preseason
  activation, and automatic-Pick evaluation and catch-up.

## Behavior

- The preseason deadline is the earliest kickoff in the complete validated
  weekly schedule and never advances to a later kickoff.
- At or after that deadline, submission is closed for the complete round and
  every server-rendered deadline remains the first kickoff.
- One-time automatic Picks become due at the fixed deadline. They select only
  Teams whose games have not started, preserving the existing eligibility
  safety rule.
- Enabling a preseason week after its first kickoff produces an immediately
  closed round; normal evaluator catch-up processes automatic Picks.
- Regular-season late Week 1 enrollment retains its rolling next-kickoff
  deadline and unstarted-Team eligibility.
- Schedule validation, exactly-once automatic-Pick completion, transactional
  submission, and fail-closed behavior remain unchanged.

## Interfaces and data

- Existing Pick and dashboard routes, methods, status values, and response
  bodies remain unchanged. Only preseason deadline values and derived open/
  closed status change.
- The browser continues formatting the server-authored ISO deadline.
- `ScheduleSnapshot`, `Pick`, and `LeagueWeekOperation` remain unchanged; no
  migration or stored-data rewrite is required.
- ESPN remains the preseason schedule provider. Fixture Download regular-
  season behavior remains unchanged.

## Design

- Preseason normalization derives `earliestKickoff` from the first game in the
  complete validated schedule while continuing to derive eligible `teams`
  from games whose kickoff is strictly after the evaluation time.
- Submission-state deadline selection stops treating preseason as rolling;
  only the existing late Week 1 enrollment flag selects the next future
  kickoff.
- Submission and automatic-Pick services continue consuming the normalized
  schedule deadline, preserving their lock-time rechecks and shared timing.
- A new abstraction or ADR is unnecessary because the existing schedule
  contract already separates deadline metadata from eligible Teams.

## Safety and delivery

- Authentication, authorization, input validation, secrets, and personal-data
  handling are unchanged.
- No migration or special rollout is required. Deploy through the normal
  GitHub-to-Heroku workflow after all required checks pass.
- Rollback is the application commit; no data rollback is required.
- Existing sanitized automatic-Pick completion and blocked-evaluation logs
  remain authoritative.

## Verification

- Update the preseason normalization regression to pin a time after the first
  kickoff and assert the fixed first-kickoff deadline with only unstarted Teams
  eligible.
- Add submission-state coverage showing preseason closed after the first
  kickoff while the displayed deadline stays fixed.
- Add automatic-Pick evaluator coverage showing evaluation is due at the fixed
  deadline and receives only unstarted Teams.
- Preserve coverage for regular late Week 1 rolling behavior.
- Run focused unit tests, then `npm run test:unit` and `npm run lint:browser`.
  Integration and browser checks are required before a pull request, using a
  disposable `TEST_DATABASE_URL` whose database name contains `test`.

## Decisions and open questions

- Resolved: automatic Picks use the fixed first-kickoff deadline but exclude
  Teams from games that have started.
- Resolved: late preseason activation is immediately closed and relies on
  normal automatic-Pick catch-up.
- Resolved: late Week 1 regular-season behavior is unchanged.
- Open questions: none.

## Completion

- Update `docs/operations/preseason-mode.md` and
  `docs/operations/auto-pick.md`.
- Residual risk: ESPN schedule corrections near kickoff can still change the
  validated schedule before completion; existing refresh, durable completion,
  and fail-closed rules govern that case.
- Next safe step: add failing regressions at normalization, submission-state,
  and evaluator seams before changing production logic.
