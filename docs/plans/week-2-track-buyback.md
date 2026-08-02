# Change contract: Week 2 Track buyback and Pick gate

Confirmed: 2026-08-02

## Problem and outcome

- The guided shared-admin Track reactivation from issue #17 does not record a
  User's season-specific buyback choice or guide eligible Users before Week 2
  Picks. The server therefore cannot distinguish unanswered, pending,
  declined, fulfilled, cancelled, expired, or already-closed opportunities.
- During server-authoritative Week 2, give eligible authenticated Users one
  durable $10-per-Track decision, block every Pick mutation until it resolves,
  and let shared admin complete exact paid subsets atomically.
- Current evidence is the absence of User buyback routes/state/UI and the
  existing independent `REACTIVATE_TRACK` repair, Pick submission, and
  automatic-Pick services.

## Scope

- In scope:
  - Week 2 eligibility for Tracks eliminated by their Week 1 Pick;
  - accessible authenticated popup, exact Track selection, total, confirmation,
    dismissal/reopen, pending status, and validated Tate contact/payment actions;
  - durable User decline/request and direct/shared-admin completion workflows;
  - a server Pick gate across final submission and automatic selection;
  - serialized deadline expiration before automatic Picks;
  - additive schema, audit/reactivation evidence, tests, and operations docs.
- Explicitly out of scope:
  - collecting or storing payment details or transaction identifiers;
  - changing the $5 new-Track enrollment price;
  - reactivating a different/new Track or erasing factual Pick history;
  - User-editable pending requests;
  - replacing shared-admin authentication;
  - post-deadline normal buybacks.
- Affected workflows: authenticated profile/Pick submission, Week 2 automatic
  Picks, User buyback decisions, shared-admin queue/direct completion, and the
  exceptional Track correction path.

## Behavior

- In active Week 2 before the earliest validated kickoff, a User is eligible
  when they own at least one currently eliminated Track whose eliminating Pick
  is a normalized Week 1 Wrong Pick and they have no Week 2 Pick.
- Eligible state is materialized under the League Season lock. The popup lists
  only eligible Track IDs and Week 1 Teams. `$10 x selected count` updates in
  the browser, but the server owns the fixed 1000-cent unit price and total.
- Dismissal records nothing. Matchups remain visible; all Pick selectors and
  submission controls stay disabled behind a persistent reopen action.
- Yes requires one or more exact eligible Tracks and a final confirmation. It
  creates one immutable `PENDING_USER_REQUEST`; exact retries return it and
  conflicting retries fail with 409. Pending status includes safe validated
  payment/contact actions and remains Pick-blocking.
- No creates terminal `DECLINED_USER`, immediately unlocks surviving active
  Tracks, and permanently suppresses the offer for that League Season.
- The shared admin sees pending requests separately from recent terminal
  history. Completion partitions every requested Track into fulfilled or
  unfulfilled, requires at least one fulfilled Track and external-payment
  confirmation, reactivates only fulfilled Tracks, and commits one
  `COMPLETED_USER_REQUEST` decision. Zero fulfillment uses `CANCELLED_ADMIN`.
- Direct admin completion selects at least one eligible Track, confirms payment,
  reactivates only those Tracks, stores `COMPLETED_ADMIN_DIRECT`, and suppresses
  the remaining opportunity.
- The existing standalone reactivation is retained only as an exceptional,
  clearly separated correction. It requires a written audit note, changes
  Track/reactivation state only, and never changes buyback decision state.
- At the authoritative deadline, both pending and unanswered eligible decisions
  become `EXPIRED_DEADLINE`; requested Tracks become unfulfilled. Expiration and
  automatic Picks share one serialized lifecycle boundary. Only surviving
  active Tracks may receive automatic Picks.
- A Pick already present at rollout or eligibility discovered after a Pick is
  recorded as terminal `CLOSED_BY_PICK`. A User eligible inside a new Pick
  transaction is instead rejected until they explicitly resolve the choice.
- Missing/malformed schedule authority presents a temporary unavailable state
  and rejects Yes, No, admin completion, and Picks without mutation.

## Interfaces and data

- Extend authenticated submission state with a sanitized `buyback` view and
  allow that read to wake the shared deadline evaluator before returning.
- Add authenticated User decision routes for pending-request confirmation and
  decline. Identity always comes from `req.session.user_id`; Track IDs are
  re-derived under lock.
- Add shared-admin list/inspect, resolve/cancel, and direct-completion routes.
  Admin responses expose sanitized display name/username, season, Track IDs,
  Week 1 Teams, totals, timestamps, current state, versions, and warnings only.
- Add `buyback_decision`, unique by User and League Season, with explicit status,
  origin, fixed unit price, state version, transition timestamps, and optional
  terminal admin audit linkage.
- Add `buyback_decision_track`, unique by decision and Track, with immutable
  membership, Week 1 Pick linkage, resolution, and optional Track reactivation
  linkage. Foreign keys prevent cross-season/Track fabrication at service seams;
  transaction validation enforces ownership and season consistency.
- Every mutation supplies the server-issued state version. Exact semantic
  retries return the existing result; stale or conflicting mutations return
  409. Serializable transactions, League Season/User/decision/Track locks, and
  uniqueness constraints serialize User, admin, deadline, submission, and
  automatic-Pick races.
- Store no Venmo credentials, payment identifiers, account data, messages,
  phone numbers, email addresses, raw requests, or payment details.

## Design

- A pure buyback policy derives eligibility, transition permissions, totals,
  safe projections, and exact Track partitions.
- A buyback application service owns materialization, serializable mutations,
  locking, idempotency/conflicts, admin reactivation, audit, and deadline
  expiration. It imports no Express or browser code.
- Pick submission calls the buyback gate inside its existing League Season
  transaction. The automatic-Pick service expires buyback state and selects
  only subsequently active Tracks in the same transaction.
- Express adapters own session/admin authorization, input mapping, safe errors,
  and private no-store responses. Browser modules own modal/draft/focus behavior
  and never decide eligibility, price, deadline, identity, or authorization.
- One parent decision plus child membership rows was chosen over separate
  decision/request headers to keep one season lifecycle and one version seam.
- No ADR is required: the design extends the existing module direction,
  transaction locking, admin audit, and lifecycle patterns.

## Safety and delivery

- User actions require the authenticated User session; admin actions require
  the existing shared-admin session before lookup. Another User's existence,
  Tracks, decisions, and contact data are never disclosed.
- Missing, malformed, stale, duplicate-conflicting, wrong-season/week,
  ineligible, already-picked, and late actions fail closed. A failed multi-write
  transaction changes no decision, Track, Pick, reactivation, or audit row.
- Logs use sanitized event categories and aggregate counts only. They exclude
  User identity, selected Teams/Tracks, requests, sessions, configuration, and
  personal/payment data.
- Ship migration, server gate, User UI, admin workflow, deadline integration,
  documentation, and tests in one application release. The branch intentionally
  depends on issue #15's validated payment/contact presentation.
- Migration is additive and forward-only. Older code ignores the new tables.
  Application rollback disables the workflow while retaining rows; do not drop
  or rewrite production state. A forward fix is required after new decisions
  have been used.
- Normal post-deadline completion is disallowed. Exceptional recovery uses the
  audited correction action and does not rewrite decision history.

## Verification

- Add failing pure tests for eligibility, statuses, totals, partitioning,
  deadline boundaries, exact retries, and gate outcomes.
- Add application/HTTP tests for authenticated safe views, decision mutations,
  admin authorization, stale/conflicting state, and every Pick route seam.
- Add disposable-MySQL tests for migrations, foreign keys, uniqueness, locks,
  full/partial/cancel/direct completion, rollback, concurrency, deadline plus
  auto-pick, prior-season isolation, and reactivation history invariants.
- Add browser unit/smoke tests for accessible modal focus, dismissal/reopen,
  disabled Pick controls, selection totals, confirmation, pending status,
  payment/contact fallbacks, narrow view, and admin queue/resolution.
- Use controlled clocks, fake schedules, deterministic automatic selection,
  and a disposable database whose URL contains `test`; never use live NFL or
  shared data.
- Run `npm run test:unit`, `npm run test:unit:coverage`, `npm run lint:browser`,
  disposable-MySQL `npm run test:integration`, `npm run test:smoke`, `npm test`,
  and `git diff --check`.

## Decisions and open questions

- Resolved decisions are the confirmed behavior, state model, correction seam,
  concurrency contract, UI gating, deadline fallback, admin queue separation,
  rollout reconciliation, branch dependency, and atomic release above.
- Open questions: none.
- External dependency: issue #15 must merge before or with this change.

## Completion

- Update behavior/route/architecture summaries, glossary, admin guide, auto-pick
  and buyback operations, migration/rollout/rollback/recovery documentation.
- Residual risks: shared-admin identity remains actorless; page-request lifecycle
  wake-up intentionally performs a narrowly scoped durable transition; a
  rollback after decisions exist requires a forward recovery release.
- Implementation and the complete local gate passed on 2026-08-02:
  - `npm run test:unit` — 149 passed;
  - `npm run test:unit:coverage` — 149 passed, 80.62% line coverage;
  - `npm run lint:browser` — passed;
  - `npm run test:integration` — 47 passed against disposable MySQL;
  - `npm run test:smoke` — 10 passed;
  - `npm test` — aggregate unit, integration, and smoke suite passed;
  - `git diff --check` — passed.
- Next safe step: review and publish only after issue #15 lands or target the
  dependent branch explicitly.
