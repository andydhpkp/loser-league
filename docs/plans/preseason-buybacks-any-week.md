# Change contract: Preseason buybacks in any week

Confirmed: 2026-08-07

## Problem and outcome

- The ordinary buyback workflow is hard-coded to a Week 1 Wrong Pick followed
  by a Week 2 decision deadline.
- Preseason may begin in any unfinished preseason week, so this prevents the
  preseason testing ground from exercising User and admin buybacks reliably.
- Make the real buyback workflow testable during any preseason week without
  changing regular-season rules.

## Scope

- In scope:
  - Preseason eligibility for any Track currently eliminated by a preseason
    Wrong Pick, regardless of its week.
  - Deadline-free preseason User decisions and admin resolution.
  - Existing Pick blocking, request, decline, direct admin completion, partial
    fulfillment, cancellation, reactivation, and audit behavior.
  - Phase-aware User and admin copy.
- Explicitly out of scope:
  - Changing regular-season Week 1 to Week 2 buybacks.
  - Multiple buyback decisions for one User in one preseason session.
  - Payment processing or storing payment details.
  - Schema changes or renaming legacy database columns.
- Affected workflows: preseason profile/Pick submission and Manage Buybacks.

## Behavior

- During an ACTIVE preseason League Season, any Track currently eliminated by
  a Wrong Pick from any preseason week is buyback-eligible.
- Preseason buyback User decisions and admin resolution do not expire or close
  at kickoff and remain available after the final preseason week closes.
- An unresolved preseason decision blocks Picks using the existing statuses.
- A terminal decision remains terminal; the User receives no second buyback
  offer during the same preseason session.
- Preseason UI uses **Preseason Track buyback** and **Eliminating Pick**.
- During regular season, eligibility remains a Week 1 Wrong Pick, the decision
  remains confined to Week 2, and the Week 2 kickoff deadline still applies.

## Interfaces and data

- Existing User and admin buyback routes remain compatible.
- Buyback views add schedule-phase context so browser copy can distinguish
  preseason from regular season.
- Existing `week_one_pick_id` storage continues to reference the eliminating
  Pick in preseason; no migration or stored-data rewrite is required.
- No external systems or new consumers are introduced.

## Design

- Pure buyback policy derives phase-aware eligibility and window rules.
- The buyback application service applies the same rules when materializing,
  gating, expiring, listing, and resolving decisions.
- The Pick league service avoids unnecessary schedule/deadline validation for
  preseason decisions and preserves it for regular Week 2.
- Browser modules render server-provided phase context and do not decide
  eligibility.
- No ADR is needed because regular production semantics and module boundaries
  remain intact.

## Safety and delivery

- Session User identity and shared-admin authorization remain unchanged.
- Reactivation still verifies ownership, League Season, current elimination,
  eliminating Pick identity, and Wrong Pick outcome inside a transaction.
- Preseason continues to store no payment details.
- Rollback is a code/documentation revert; no migration or data recovery is
  required.
- Audit descriptions and weeks identify the actual preseason resolution week.

## Verification

- Pure policy tests cover regular and preseason eligibility/window rules.
- Service tests cover later/final preseason weeks, no deadline expiry, Pick
  blocking, User decisions, admin direct and request resolution, terminal
  one-time behavior, and unchanged regular-season rejection/deadlines.
- Integration tests exercise a later-week preseason Wrong Pick through User
  request, Pick blocking, and admin reactivation.
- Browser tests cover phase-aware User and admin labels.
- Run unit tests, unit coverage, browser lint, integration tests against the
  disposable test database, browser smoke tests, and `git diff --check`.

## Decisions and open questions

- Resolved:
  - Any current preseason Wrong Pick elimination is eligible.
  - Preseason has no kickoff deadline for decisions or admin resolution.
  - One decision per User per preseason session remains the invariant.
  - Preseason copy is phase-aware; regular copy remains unchanged.
- Open questions: none.
- External dependencies: none beyond the existing disposable test database.

## Completion

- Implemented and verified on 2026-08-07:
  - `npm run test:unit` — 208 passed;
  - `npm run test:unit:coverage` — 208 passed, 90.30% line coverage;
  - `npm run lint:browser` — passed;
  - `npm run test:integration` — 55 passed against the configured disposable
    test database;
  - `npm run test:smoke` — 129 passed;
  - `git diff --check` — passed.
- Updated preseason operations, buyback operations, Help, User buyback, admin
  buyback, and dashboard copy.
- Residual risk: legacy storage names remain Week-1-specific, but runtime views
  and validation use the actual eliminating Pick.
- Next safe step: review and commit only the requested League-view and
  preseason-buyback files, excluding unrelated crown-layout changes.
