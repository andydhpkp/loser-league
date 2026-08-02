# League lifecycle program summary

Completed across PRs #28–#38 in August 2026. The detailed decision history and
verification ledger remain in
[`../plans/league-lifecycle-program.md`](../plans/league-lifecycle-program.md).

## Result

The League Season is now server-authoritative from setup through rollover:

1. An explicit year starts in `SETUP`, Week 0. Track creation is allowed in
   Week 0 and Week 1 before kickoff.
2. Admin explicitly starts Week 1 after schedule validation.
3. A User submits one final selection set for every active Track. Normalized
   Picks and compatibility projections commit atomically.
4. At the deadline, each missing active Track receives its own independent
   random eligible Team. Concurrent evaluators converge on one result.
5. Targeted result polling begins near expected game finishes. Automatic and
   manual closure share one exactly-once transaction and advance only after
   every selected game resolves.
6. Guided shared-admin tools cover current-Pick repair, Week 1 buyback,
   playoff Pick-pool reset, historical correction, outcome reconciliation,
   projection rebuild, and conditional undo.
7. Admin explicitly completes a closed season by selecting winning Tracks.
   The server deduplicates owners and records solo or tied User wins.
8. Rollover validates an explicitly entered successor year, downloads a
   checksum-bound sanitized JSON export, deletes outgoing Track-owned data,
   Picks, and Tracks, preserves Users/wins and compact evidence, and creates
   the successor at Week 0.

Admin is never a User. Admin access is the separate shared-password session,
and every audit is actorless by design.

## Concurrency and recovery

- League Season row locks serialize submission, auto-pick, closure, repairs,
  completion, and rollover. Unique phase records and one-use previews make
  retries idempotent.
- Multi-write invariants use transactions. Stale previews, changed schedules,
  incomplete selected games, invalid targets, and partial failures fail closed.
- Pick behavior remains the established behavior: one current Pick per Track,
  prior selections remain used, selecting a winning Team is a Wrong Pick, and
  the manual playoff reset starts a new Pick cycle without rewriting history.
- A Week 1 buyback reactivates the same Track, preserves the factual Wrong Pick
  and used Team, and does not fabricate history.
- After a real rollover or playoff cycle reset, recovery must be a forward
  application fix; old cycle/rollover-unaware code is not rollback-safe.

## Route disposition

- Active User Pick flow: `/api/user/league`.
- Active shared-admin mutation flow: `/api/admin/actions` and guided inspector
  routes.
- Active Fixture browser feed: `/api/proxy/nfl`, with the year resolved from
  stored League Season state.
- Browser force-pick, result orchestration, hard-coded week storage, no-op
  polling, direct buyback helpers, and the fixed 2025 Fixture proxy were
  removed after reference and replacement proof.
- Raw Track repair and maintenance routes remain early-authenticated,
  transactionally audited `LEGACY_EMERGENCY_REPAIR` owner tools. They are
  intentionally retained because this is a one-engineer operation and those
  endpoints are used for exceptional fixes.

## Production delivery

| Capability | PR | Production |
| --- | ---: | --- |
| Season/Pick foundation | #28/#29 | Heroku v258 |
| Admin action foundation | #30/#31 | Heroku v259 |
| Atomic final submission | #32 | Heroku v260 |
| Independent exactly-once auto-pick | #33 | Heroku v261 |
| Exactly-once week closure | #34 | Heroku v262 |
| Guided repairs and Pick cycles | #35 | Heroku v263 |
| Historical repair and undo | #36 | Heroku v264 |
| Raw emergency hardening | #37 | Heroku v265 |
| Completion and rollover | #38 | Heroku v266 |

Every production entry above passed the repository gate against its exact
merge SHA and then passed bounded homepage and NFL Teams health checks. PR 8
performs final dead-code cleanup and records the final verification separately.

## Remaining work outside the program

Open Issues #15 (zero-Track onboarding), #18 (optional Google SSO), and #20
(winner crown request) are separate product work. This program does not decide
or implement them.
