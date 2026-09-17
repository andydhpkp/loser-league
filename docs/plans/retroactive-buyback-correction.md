# Change contract: Retroactive Track buyback correction

Status: confirmed by the User; implemented locally, not deployed.

## Problem and outcome

- An admin applied a buyback to the wrong Track after which Picks were submitted.
  The requested correction restores elimination without deleting the Track.
- Manage Buybacks currently writes terminal decisions and non-undoable audits.
  Exceptional reactivation is a different path and does not itself count toward
  the pot. The reported Track deletion error has not been reproduced or diagnosed.
- Add an explicit, previewed Track correction with independently chosen pot
  treatment, preserving factual history and an explanation of the correction.

## Scope

- In scope: selected Track, existing historical Wrong Pick, reversal of applicable
  reactivation/buyback effects, later Pick voiding, pot impact preview, optional
  compensating pot adjustment, admin history and gameplay consumers.
- Out of scope: permanent Track deletion fixes, arbitrary game-result overrides,
  payment/refund processing, general-purpose pot editing, transferring a buyback
  to another Track, and reopening the User's terminal buyback offer.
- Other Users, Tracks, and buybacks retain their existing behavior.

## Behavior

- On a selected Track, offer Set Wrong Pick. List only that Track's existing,
  non-void Wrong Picks, labelled with week and Team; never another Track's Picks.
- Selecting the historical Wrong Pick restores elimination from that Pick and
  reverses reactivation effects that would otherwise waive that elimination.
- Void all later Picks for gameplay, including an already-submitted current-week
  Pick. Retain settled outcomes and selection history as visibly void records;
  retain pending Pick history as well. Do not rewrite factual game outcomes.
- Allow correction only in an ACTIVE season before the current week's earliest
  validated kickoff. Reopen in a subsequent week when that week is current and
  its first kickoff remains in the future. At kickoff the window is closed.
  Missing or malformed schedule evidence blocks correction. Confirmation
  rechecks the window and all relevant state.
- Preview exact affected Picks, elimination, buyback effects, and money: current
  User contribution, counted buybacks, league total, change, and resulting User
  contribution, buyback count, and league total.
- Offer Reset and reverse counted buyback, or Reset and keep pot unchanged.
  Compute the difference from actual counted records and exemptions, never assume
  every reactivation contributes $10. Preserve the original $5 Track contribution.
- Reverse counted buyback excludes this Track's reversed fulfillment from the
  effective buyback count. Keep pot unchanged additionally records a separate,
  audited compensating adjustment equal to the actual removed contribution,
  with a required explanation. Do not retain a false active buyback count.
- An uncounted exceptional reactivation or exempt contribution produces a $0
  difference and no artificial $10 adjustment. Show adjustments separately in
  the pot breakdown and include them in User and league totals.
- Preserve original buyback decision history and record its correction explicitly;
  do not reopen eligibility, retrigger an offer, or touch other memberships.
- Preview/confirmation is authorized, atomic, stale-safe and idempotent. Replaying
  confirmation cannot duplicate adjustments or reverse the same buyback twice.

## Interfaces and data

- Add a registered action using existing authenticated preview/confirm routes.
  Extend the selected-Track inspector and admin workspace with eligibility,
  historical void/correction information and the preview controls.
- Extend pot reporting additively with adjustment totals. Preserve existing fields
  and update their consumers so displayed totals remain internally consistent.
- Use forward-only persistence for Pick void status, reactivation/buyback reversal
  evidence and season/User/Track-linked pot adjustments tied to an audit operation.
  Migration `20260917000000-add-track-corrections.js` adds nullable audit-operation
  references to Picks, reactivations and memberships plus a separate
  `league_pot_adjustment` table. See ADR 0005 for scope/history semantics.
- Existing gameplay consumers must exclude void Picks and reversed reactivations;
  history views must retain and label them. Review submission, auto-pick, closure,
  projection rebuild, repairs/undo, dashboard, league statistics and rollover.

## Design

- Keep correction policy and transactional orchestration in application modules;
  HTTP adapters parse/map and browser modules render server-owned previews.
- Reuse action preview/audit and pot calculation seams. The same authoritative
  contribution rules must power preview and the displayed pot.
- A raw wrong_pick update is insufficient: normalized elimination, reactivation,
  later Picks and counted buybacks must agree after correction.
- Document historical void semantics and separate pot adjustments in an ADR.

## Safety and delivery

- Shared-admin authorization is mandatory. Require a correction explanation;
  prohibit personal/payment details in explanations and logs.
- Lock and revalidate season, schedule, Track, affected Picks, reactivations,
  membership and relevant pot state. A change in displayed monetary impact
  invalidates the preview and requires a fresh review.
- Commit correction evidence, voiding, projections, accounting and audit together.
  Roll back all writes on failure. Preserve terminal buyback retry semantics.
- Deploy migration and code through the normal verified release workflow.
  After corrections exist, old code unaware of voids/reversals/adjustments is not
  a safe rollback target; use a forward fix. No live-data mutation is authorized
  by this implementation contract without an exact target and reviewed preview.
- Confirmed: this compound historical correction is non-undoable through
  the generic undo action; preserve evidence for a separately reviewed repair.

## Verification

- Add regression coverage before implementation for completed Manage Buybacks
  with subsequent submitted Picks, and exceptional reactivation without a counted
  buyback. Use synthetic data in a disposable MySQL schema containing test.
- Test counted/uncounted/exempt cases, both pot choices, accurate User/league
  totals, required explanation, unaffected siblings, settled and pending later
  Picks, next-week reopening, exact kickoff, missing schedule and closed season.
- Test unauthorized and wrong-owner Pick requests, stale target/money/schedule,
  confirmation replay, double correction, transaction rollback and lifecycle
  consumers ignoring void/reversed records while history retains them.
- Browser coverage: selection, monetary preview, both choices, confirmation,
  disabled/unavailable states, refresh, history labels and mobile layout.
- Run unit, unit coverage, browser lint, disposable-database integration and
  browser smoke checks; all must pass before PR creation. Record exact results.

## Decisions and open questions

- Confirmed: historical Wrong Pick selection, later Pick voiding, separate pot
  treatment, audited adjustment with explanation, weekly pre-kickoff window,
  and settled history preservation when correcting in a later week.
- Confirmed: this compound correction is non-undoable through generic Undo.

## Completion

- Update buyback and guided-repair runbooks, pot plan/operations, route contracts,
  architecture, history semantics ADR and relevant glossary language.
- Residual risk: historical void semantics affect several gameplay readers;
  narrow UI-only or projection-only changes would be incomplete.
- Next safe step: review and release the code with its forward-only migration.
  Correct the intended production Track through the new preview after deployment.


## Verification evidence — 2026-09-17

- Regression-first: `node --env-file-if-exists=.env --test
  test/integration/buyback-correction.test.js` initially failed at the real action
  seam with `Admin action not found`. Fixed fixture/sandbox setup failures were
  not treated as evidence of feature behavior.
- `npm run test:unit` — passed, 369 tests.
- `npm run test:unit:coverage` — passed on final application source, 369 tests,
  91.55% line coverage (90% required).
- `npm run lint:browser` — passed. Initial Event-global lint failure was fixed
  using `window.Event`, then lint was rerun successfully.
- `npm run test:integration` — passed on final application source, 92 tests,
  with zero skips against disposable MySQL.
- `npm run test:smoke` — passed, 191 browser tests, including both accounting
  choices and void history in the selected-Track workspace.
- `node --env-file-if-exists=.env --test --test-concurrency=1
  test/integration/buyback-correction.test.js test/integration/migrations.test.js`
  — passed on final application source, 12 tests including migration, ownership
  staleness, automatic selection and closure.
- `git diff --check` — passed.
- Database tests used the configured disposable `TEST_DATABASE_URL`, whose name
  is validated to contain `test`; no shared or production data was used.
- Initial local-server/database sandbox restrictions were resolved through
  approved escalated test runs. No required checks remain sandbox-blocked.
- No production migration, deployment, Track correction, commit or PR was made.
  The originally reported Delete Track failure remains outside this correction
  contract and has not been diagnosed or claimed fixed.
