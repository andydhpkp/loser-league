# League lifecycle multi-PR program

Confirmed: 2026-08-01

## Outcome

Replace browser-owned and raw-field league maintenance with one
server-authoritative League Season lifecycle, normalized weekly Picks,
exactly-once transitions, and guided shared-admin operations. Deliver the work
as sequential, independently verified pull requests rather than one stacked
change.

## Authority and product boundaries

- Admin access remains the existing shared `ADMIN_PASSWORD` and eight-hour
  server session.
- Admins are not Users. There is no Admin model, Admin table, User admin role,
  or relationship between User login and admin access.
- Admin audits do not identify an individual actor.
- Users, their win records, and User authentication survive League Season
  rollover. Tracks and Picks are current-season data and are deleted at
  rollover after a minimal verified export.
- The existing password-reset workflow is explicitly outside this program.

## Confirmed domain model

- A League Season has an explicit year, current week, state version, and state:
  `SETUP`, `ACTIVE`, `COMPLETE`, or `ROLLED_OVER`.
- Week 0 is setup. A shared admin explicitly starts Week 1 after schedule
  validation.
- Only one League Season may be in `SETUP` or `ACTIVE` state.
- Existing Tracks are associated through an explicit, idempotent bootstrap
  command requiring League Season year, state, and week; migrations never guess
  production lifecycle state.
- One normalized Pick row represents one Track, League Season, and week.
- A committed current Pick immediately counts as used. Available Teams are the
  Team catalog minus every Team already selected by that Track in the League
  Season.
- Pick origin values distinguish `USER_SUBMISSION`, `AUTOMATIC_SELECTION`,
  `SHARED_ADMIN_REPAIR`, and migration-only `LEGACY_BACKFILL`; they do not
  identify an admin.
- Pick outcome is `PENDING`, `PREDICTION_CORRECT`, or `WRONG_PICK`.
- A Track's nullable eliminating-Pick reference determines whether it is
  eliminated. The referenced Pick supplies the Team and week.
- A Week 1 buyback preserves the factual Wrong Pick and all Pick history while
  clearing the Track's eliminating-Pick reference. The server enforces that the
  eliminating Pick is from Week 1. Week 2/pre-deadline timing is prominent
  operating guidance, not a server restriction.
- A late buyback may leave an intentional missing-week gap explained by its
  audit entry. Other guided repairs may not create unexplained closed-week
  gaps.

## Confirmed lifecycle

### Track enrollment and season start

- Standard Track creation is allowed in Week 0 and in Week 1 strictly before
  the earliest scheduled kickoff.
- The admin enters the new four-digit League Season year explicitly during
  rollover; the form is blank and has no inferred `+1` default.
- The stored active year drives all NFL integrations, schedule snapshots,
  caches, lifecycle operations, logs, and browser-facing stable routes.

### Final User submission and visibility

- Draft Picks exist only in page memory and disappear on refresh or close.
- One final action submits and locks Picks for every active Track owned by the
  authenticated User in one transaction.
- Any missing, stale, late, reused, ineligible, cross-owner, or invalid Pick
  rejects the entire submission.
- Ordinary Users cannot edit committed Picks.
- Before a User has submitted every active Track, server responses expose
  submission status but hide all current-Pick identities and derived data.
- A User with no active Tracks may see current Picks. Eliminated Tracks do not
  require a submission.

### Auto-pick

- The earliest validated Fixture Download kickoff for the active year/week is
  the submission deadline.
- At or after the deadline, every active Track missing a Pick receives an
  independent uniform random choice from its own eligible Team set.
- Different Tracks may receive the same Team. Production uses
  `crypto.randomInt`; tests inject a deterministic random source.
- Existing submitted Picks and eliminated Tracks remain unchanged.
- Invalid schedule or Track state fails the entire operation closed.

### Weekly results and advancement

- Fixture Download defines the complete active-week schedule. ESPN explicit
  terminal status supplies official results. Games match by season, week, and
  both Teams rather than array position.
- Automatic closure waits for every scheduled game to reconcile and finish.
- A tie is a Wrong Pick for either selected Team.
- A shared admin may manually close a week before unrelated games finish only
  when auto-pick is complete and every active Track's current Pick has an
  authoritative terminal result from ESPN or a guided official-result
  override.
- Manual closure requires an explanatory note and previews unfinished
  unselected games.
- Automatic and manual closure compete for one exactly-once `CLOSE_WEEK`
  phase. One mode can commit; the other becomes a no-op.
- Lifecycle phases are unique by League Season, week, and phase. Initial phases
  are `START_SEASON`, `AUTO_PICK`, and `CLOSE_WEEK`.
- Timers, periodic recovery, and startup catch-up call the same database-locked,
  idempotent services. The confirmed #19 contract omits page wakeups and manual
  auto-pick evaluation because the 30-second server recovery loop is sufficient.

### Completion and rollover

- A shared admin explicitly completes a League Season after a closed week.
- The admin selects winning Tracks. The server derives unique winning Users:
  one User receives a solo win; multiple Users each receive a tied win;
  multiple winning Tracks owned by one User still produce one solo User win.
- Rollover requires a minimal sanitized JSON export bound to its checksum. No
  CSV, reporting UI, or in-database artifact retention is required.
- One transaction deletes outgoing Tracks and their Pick rows, preserves Users
  and win records, marks the outgoing season rolled over, and creates the
  explicitly entered successor year at Week 0.
- Compact schedule hashes, lifecycle summaries, and sanitized append-only admin
  audits survive rollover.

## Shared-admin operations

- Every admin mutation, including existing Track/User management and win
  recording, creates an audit entry.
- Audit entries contain no actor field. They include action, generated
  description, note, timestamp, final status, season/week, affected numeric
  IDs, sanitized before/after state, and optional undo linkage.
- One operation summary has target rows for each affected User, Track, or Pick.
- Short-lived persisted previews bind normalized intent to state versions,
  schedule hashes, expiration, and a one-time confirmation key. Confirmation
  reauthorizes, locks, revalidates, and rejects stale state.
- Undo is action-specific, allowed at most once, and succeeds only when all
  targets still match the original after-state. An undo is not itself undoable.
- User/Track deletion is audited but not undoable.
- Selected-Track and every-Track reset are separate actions for correcting bad
  current-week submissions. They may run after kickoff, but weekly closure is
  blocked until every active Track again has a valid Pick. Auto-pick never
  reruns; post-deadline replacements are shared-admin actions.
- Every existing raw repair capability must be mapped to a guided registered
  action before its endpoint can retire.
- The action registry supplies authorization, preview, warnings, instructions,
  undo metadata, and Admin Guide content.

## Route migration policy

1. Characterize every route and caller.
2. Require the shared-admin session early for repair, maintenance, force-pick,
   destructive management, and direct result mutations.
3. Move active behavior to purpose-specific User, lifecycle, or admin routes.
4. Map every raw repair endpoint to a guided replacement with equivalent
   operational capability.
5. Remove browser-owned lifecycle orchestration and raw endpoints only after
   replacement tests, reference searches, and documentation prove them
   superseded.
6. Do not preserve compatibility wrappers for hypothetical third-party API
   consumers; this is a one-engineer application with known browser and manual
   workflows.

The detailed route inventory is maintained below during delivery.

| Existing capability | Disposition | Replacement PR | Status |
| --- | --- | --- | --- |
| Raw repair and maintenance routes | Retained admin-only with transactional legacy audit; guided mapping documented | Admin repair | PR 6C implemented; final deletion proof pending |
| Browser Track Pick write | Replaced with atomic final submission | Final submission | PR gate passed |
| Browser force-pick | Replaced with server lifecycle auto-pick | Auto-pick | PR gate passed |
| Browser result and current-Pick reset orchestration | Replaced with server week closure | Weekly results | Implemented; PR gate pending |
| Admin Track/User create/delete and add-win | Move behind audited admin actions | Admin infrastructure | PR gate passed |
| Buyback wrong-Pick reset | Replace with guided Week 1 buyback | Admin repair | Pending |

## Pull-request sequence

| Order | Scope | GitHub issue | Status |
| ---: | --- | --- | --- |
| 1 | League Season and normalized Pick foundation | #27 | Complete; PR #28 plus deployment repair #29 |
| 2 | Admin authorization boundary, action registry, previews, audit, existing admin mutations | #12A | Complete; PR #30 plus CI fixture repair #31 |
| 3 | Atomic final Pick submission and visibility | #13 | Complete; PR #32, Heroku v260 |
| 4 | Exactly-once independent per-Track auto-pick | #19 | Complete; PR #33, Heroku v261 |
| 5 | Exactly-once results and automatic/manual week closure | #11 | Complete; PR #34, Heroku v262 |
| 6A | Repair schema/inspector, current-week tools, buyback, playoff Pick reset | #12B and #17 | Complete; PR #35, Heroku v263 |
| 6B | Historical repair, reconciliation, projection rebuild, conditional undo | #12B | Complete; PR #36, Heroku v264 |
| 6C | Raw emergency hardening/audit, complete Admin Guide and mapping | #12B | Complete; PR #37, Heroku v265 |
| 7 | Explicit completion and export-backed rollover | #14 | PR gate passed |
| 8 | Superseded-route/browser cleanup and full-program verification | Program tracker | Pending |

Issue #12 remains open until both #12A and #12B are complete.

## Delivery and verification

- Deliver sequentially. Each branch starts from fresh `main` only after the
  preceding PR is merged.
- Run the repository's complete PR verification gate against final committed
  source for every PR. A skipped, unavailable, blocked, or known-failing check
  blocks PR creation.
- After every merge, verify the automatic Heroku deployment, migration state,
  and production health before beginning the next branch.
- Use only disposable MySQL schemas whose `TEST_DATABASE_URL` database name
  contains `test`.
- Never retrieve or expose production credentials, sessions, environment
  values, User personal data, or production Track/Pick data.

## Program status updates

Update this document after each PR with:

- issue and PR links;
- migration phase and compatibility state;
- exact verification commands/results;
- deployment verification;
- route inventory changes;
- residual risk and next safe step.

### PR 1 verification — 2026-08-01

- `npm run test:unit` — passed, 79 tests.
- `npm run test:unit:coverage` — passed, 86.77% line coverage.
- `npm run lint:browser` — passed.
- `npm run test:integration` — passed, 8 tests against the configured
  disposable MySQL schema guarded by a database name containing `test`.
- `npm run test:smoke` — passed, 7 Playwright tests.
- `NODE_ENV=test npm run db:migrate` — passed against disposable MySQL; an
  immediate repeat executed no migrations.

### PR 6A verification — 2026-08-01

- `npm run test:unit` — passed, 120 tests.
- `npm run test:unit:coverage` — passed, 82.61% line coverage.
- `npm run lint:browser` — passed.
- `npm run test:integration` — passed, 31 tests against the configured
  disposable MySQL schema guarded by a database name containing `test`.
- `npm run test:smoke` — passed, 7 Playwright tests.
- `NODE_ENV=test npm run db:migrate` from an empty, runtime-verified
  `loser_league_test` schema — passed; immediate repeat executed no migrations.

PR 6A is forward-compatible before the manual Week 19 reset. After an Admin
starts Pick cycle 2, rollback to cycle-unaware code is unsafe and recovery must
be a forward fix. Retained raw emergency routes are unchanged in this PR and
remain scheduled for PR 6C authorization/audit and mapping.

PR #35 merged as `96547ef`. Workflow 30730865917 passed the complete gate
against that exact SHA, Heroku release `v263` succeeded, migration
`20260801040000-add-pick-cycles-and-track-reactivations` completed, and `/`
plus `/api/nfl/teams` were healthy.

### PR 6B verification — 2026-08-02

- `npm run test:unit` — passed, 126 tests.
- `npm run test:unit:coverage` — passed, 82.83% line coverage.
- `npm run lint:browser` — passed.
- `npm run test:integration` — passed, 35 tests against the guarded disposable
  MySQL schema.
- `npm run test:smoke` — passed, 7 Playwright tests.
- No schema migration is included in PR 6B.

PR #36 merged as `79c4f6f`. Workflow 30731534035 passed the complete gate
against that exact SHA, Heroku release `v264` succeeded, and `/` plus
`/api/nfl/teams` were healthy.

### PR 6C verification — 2026-08-02

- `npm run test:unit` — passed, 131 tests.
- `npm run test:unit:coverage` — passed, 83.19% line coverage.
- `npm run lint:browser` — passed.
- `NODE_ENV=test npm run test:integration` — passed, 36 tests against the
  runtime-verified `loser_league_test` disposable schema.
- `npm run test:smoke` — passed, 7 Playwright tests.
- No schema migration is included in PR 6C.

PR 6C preserves every retained raw Track mutation's method, path, input, and
successful response while adding early shared-admin authorization, serialized
transactional mutation/audit, sanitized changed-Track targets, and rollback on
audit failure. The authenticated Admin Guide is registry-derived, and the raw
to guided route mapping is complete. Residual route deletion work remains in
the final cleanup PR after reference and replacement proof.

Draft PR #37 opened from commit `46bcb2c`; GitHub Actions run 30732701697 and
GitGuardian passed. The documentation-only status commit that records this
evidence must also clear the remote gate before the PR is marked ready.

The first post-merge deployment created Heroku release `v257`, but its release
command failed because the migration CLI had been pruned as a development
dependency. The prior production release remained healthy. Workflow run
30713325529 nevertheless reported success because it checked that prior release;
the forward repair is tracked in
[`heroku-release-verification-fix.md`](heroku-release-verification-fix.md).

### PR 1 production completion — 2026-08-01

- PR #29 merged as `a0295f9`; workflow 30713648912 passed the complete gate
  against that exact SHA.
- Heroku release `v258` succeeded. The baseline and League Season foundation
  migrations completed, the new release-status gate passed, and `/` plus
  `/api/nfl/teams` were healthy.
- The first `2026 / SETUP / week 0` preview rejected obsolete 2025 Tracks with
  used Picks and changed nothing.
- With explicit approval, one serializable fail-closed cleanup deleted 314
  obsolete Tracks, verified zero remaining Tracks/Picks, and verified the User
  count was unchanged. The deletion is permanent.
- The repeated bootstrap preview reported zero Tracks, Picks, and eliminations.
  Apply created the open 2026 League Season at Week 0, and exact replay returned
  `alreadyApplied: true` without further mutation.
- Foundation production rollout is complete. The next delivery is #12A.

### PR 2 verification — 2026-08-01

- Issue #12 was corrected to preserve the shared-password admin boundary: an
  admin is never a User and audit rows have no actor attribution.
- The additive #12A migration, registered preview/confirm actions, browser
  migration, and append-only operation/target audit passed the full PR gate.
- `npm run test:unit` — passed, 84 tests.
- `npm run test:unit:coverage` — passed, 84.98% line coverage.
- `npm run lint:browser` — passed.
- `npm run test:integration` — passed, 10 tests against disposable MySQL.
- `npm run test:smoke` — passed, 7 Playwright tests.
- `git diff --check` — passed.
- The migration is additive and the prior application ignores the new tables.
  Existing general-purpose/manual routes remain during the expand phase.

### PR 5 implementation — 2026-08-01

- Weekly results are server-owned and reconcile the complete Fixture schedule
  with ESPN explicit terminal results or immutable actorless overrides.
- Targeted polling begins at each expected finish, collapses overlapping games
  to one request per minute, and backs delayed games off to five-minute Fixture
  refreshes. Startup catch-up and recovery use the same evaluator.
- One serializable `CLOSE_WEEK` transaction settles Picks, eliminates Tracks,
  clears compatibility current Picks, preserves used/available Picks, and
  advances at most once. Concurrent automatic/manual attempts converge on one
  commit. Week 22 remains active at Week 22.
- Registered `OVERRIDE_GAME_RESULT` and `CLOSE_WEEK` controls use the existing
  shared-admin preview/confirm/audit foundation. Admin remains separate from
  User and audits contain no actor.
- The League page retains terminal result coloring but has no Track or Team
  mutation path. Raw repair endpoints remain available for later mapped-repair
  work.
- `npm run test:unit` — passed, 114 tests.
- `npm run test:unit:coverage` — passed, 80.26% line coverage.
- `npm run lint:browser` — passed.
- `npm run test:integration` — passed, 22 tests against disposable MySQL.
- `npm run test:smoke` — passed, 7 Playwright tests.
- `git diff --check` — passed.
- PR #34 merged as `de10537`. Workflow 30720023219 passed the complete gate
  against that exact SHA, Heroku release `v262` succeeded, migration
  `20260801030000-add-official-game-result-overrides` completed, and `/` plus
  `/api/nfl/teams` were healthy. Issue #11 is closed.
- Track creation preserves the legacy Week-1 allowance in #12A; #13 will add
  the confirmed schedule-aware pre-kickoff enforcement.
- PR #30 merged as `c61e981`. Its first workflow correctly stopped before
  deployment when a clean-checkout integration fixture exposed a missing
  required User field.
- PR #31 merged as `367eb65` with the one-line fixture correction. Workflow
  30714814887 passed the exact SHA, Heroku release `v259` succeeded, migration
  `20260801010000-add-admin-action-foundation` completed, and `/` plus
  `/api/nfl/teams` were healthy.
- #12A is complete in production. #12 remains open for the #12B guided repair,
  reset, buyback, undo, inspector, and Admin Guide work.

### PR 3 implementation — 2026-08-01

- Added authenticated `/api/user/league` submission-state, atomic final
  submission, and eligibility-aware league-view interfaces.
- Final submission fetches fresh Fixture Download evidence, binds its hash to
  the locked League Season/week, and commits normalized Picks plus temporary
  legacy Track projections in one serializable transaction.
- Exact retries succeed, differing and competing submissions cannot replace a
  committed Pick set, and injected mid-write failure rolls back every Pick and
  Track projection.
- League responses omit every current-Pick identity and Pick-derived value
  until the viewing User has submitted every active Track. Personalized
  responses are private and not cacheable.
- The browser now reviews and submits all active Tracks together and uses the
  server League Season week. General User/Track paths no longer expose raw Pick
  identities to ordinary consumers; shared-admin/manual repair paths remain
  available for the one-engineer operating workflow.
- Added the nullable `pick.schedule_hash` expand migration. The prior release
  ignores the new column, so rollout and rollback remain compatible.
- `npm run test:unit` — passed, 89 tests.
- `npm run test:unit:coverage` — passed, 83.09% line coverage.
- `npm run lint:browser` — passed.
- `npm run test:integration` — passed, 14 tests against disposable MySQL.
- `npm run test:smoke` — passed, 7 Playwright tests.
- `git diff --check` — passed.
- PR #32 merged as `2be1bd8`. Workflow 30716284808 passed the complete gate
  against that exact SHA, Heroku release `v260` succeeded, migration
  `20260801020000-add-pick-schedule-hash` completed, and `/` plus
  `/api/nfl/teams` were healthy. Issue #13 is closed.

### PR 4 implementation — 2026-08-01

- Replaced browser/localStorage/`Math.random` scheduling with server startup,
  exact-deadline, schedule-refresh, and 30-second recovery evaluation.
- Reused the durable unique `AUTO_PICK` phase and normalized Pick rows; no new
  migration is required.
- Each missing active Track receives an independent `crypto.randomInt` draw
  from its own eligible set in one serializable all-or-nothing transaction.
- Existing submitted Picks and eliminated Tracks remain unchanged. Projection
  inconsistencies, invalid schedules, exhausted eligibility, and write failures
  leave the operation uncommitted for automatic retry.
- Removed the public force-pick endpoint and all browser auto-pick scheduling
  after replacement tests and reference searches proved them superseded.
- `npm run test:unit` — passed, 93 tests.
- `npm run test:unit:coverage` — passed, 82.42% line coverage.
- `npm run lint:browser` — passed.
- `npm run test:integration` — passed, 17 tests against disposable MySQL.
- `npm run test:smoke` — passed, 7 Playwright tests.
- `git diff --check` — passed.
- PR #33 merged as `2175a30`. The complete GitHub Actions gate passed against
  that exact SHA, Heroku release `v261` succeeded, and issue #19 is closed.

### PR 7 implementation — 2026-08-02

- Added registered, actorless `COMPLETE_LEAGUE_SEASON` and
  `ROLLOVER_LEAGUE_SEASON` admin actions with persisted previews, season locks,
  stale-state checks, serializable transactions, and replay-safe audits.
- Completion derives solo/tied User wins from unique owners of the selected
  winning Tracks and requires a closed-week boundary with no next-week work.
- Rollover validates the explicitly entered target year against Fixture
  Download, downloads a checksum-bound sanitized JSON export, deletes outgoing
  Track-owned data/Picks/Tracks, and creates the successor in Week 0.
- Users, win histories, schedule snapshots, week operations, official-result
  overrides, and append-only audit evidence survive. No schema migration is
  required.
- The live browser Fixture proxy now resolves the stored open League Season
  year; the year-named 2025 route remains for historical compatibility only.
- `npm run test:unit` — passed, 135 tests.
- `npm run test:unit:coverage` — passed, 83.33% line coverage.
- `npm run lint:browser` — passed.
- `npm run test:integration` — passed, 38 tests against the guarded disposable
  MySQL schema.
- `npm run test:smoke` — passed, 7 Playwright tests.
- `git diff --check` — passed.
