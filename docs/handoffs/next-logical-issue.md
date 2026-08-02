# Handoff: issue #15 — zero-Track onboarding

Prepared: 2026-08-02

## Recommendation

After the lifecycle cleanup PR merges and deploys, take
[Issue #15](https://github.com/andydhpkp/loser-league/issues/15), **Improve
zero-Track onboarding with payment instructions, Venmo, and league contacts**.

The server-authoritative lifecycle program is complete. Issue #15 is now the
best next product slice because rollover creates a real Week 0/Week 1
enrollment window and the zero-Track experience can use that state rather than
guessing from browser time. Issue #18 remains explicitly lowest priority.
Issue #20 is a winner-record/crown follow-up and should not be conflated with
onboarding.

## Starting point

- Read [`../engineering/lifecycle-program-summary.md`](../engineering/lifecycle-program-summary.md)
  for the completed architecture and route disposition.
- Admin is never a User. Shared-admin access remains a separate password/session
  flow with actorless audits.
- Track creation is allowed in Week 0 and Week 1 before kickoff through the
  established admin workflow.
- Users, credentials, and win history survive rollover; outgoing Tracks/Picks
  do not.
- The existing profile code contains a rudimentary Venmo/no-Track message in
  `public/js/teams.js`. Treat it as observed behavior and inspect its callers;
  do not assume it satisfies Issue #15.

## Required workflow

1. Start from fresh remote `main` only after the cleanup PR is merged and its
   Heroku deployment is verified.
2. Read `AGENTS.md`, `docs/engineering/README.md`, `CONTEXT.md`, Issue #15, and
   this handoff.
3. Inspect the zero-Track responses and page entry seams in
   `server/modules/picks/league-service.js`, `server/user/`, `public/js/teams.js`,
   `public/js/pages/profile.js`, the relevant HTML, and tests.
4. Run the required grill-style planning session one decision at a time. In
   particular, confirm exact copy, contacts, payment link ownership, when the
   message appears, and whether it differs when enrollment is closed.
5. Save the confirmed contract under `docs/plans/` before implementation and
   add tests at the HTTP/pure/page-entry seams.

Do not collect payment data, infer payment completion, expose personal contact
details without explicit approval, or let browser state decide enrollment.
Run the complete repository PR gate before publishing.
