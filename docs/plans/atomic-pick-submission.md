# Change contract: Atomic final Pick submission and visibility

Confirmed: 2026-08-01

## Problem and outcome

- Current browser navigation uses local Pick counts to decide whether a User may
  open the league page, while general User/Track routes expose raw current-Pick
  state. Direct requests, stale tabs, or manipulated browser storage can bypass
  that presentation-only check.
- Current submission writes one Track at a time, so partial writes are possible
  and ordinary Users can replace a Pick after submitting.
- Add one server-authoritative final submission for every active Track owned by
  the authenticated User and enforce current-week Pick visibility on every
  response.

## Scope

- In scope:
  - Ephemeral browser drafts and an accessible review/confirmation dialog.
  - Fresh validated Fixture Download schedule evidence and one weekly deadline.
  - One authenticated, atomic, idempotent final-submission route.
  - One authenticated submission-state route for the User's own Tracks.
  - One authenticated, eligibility-aware league-view route.
  - Server-side redaction/removal of alternate raw current-Pick disclosures.
  - Transactional legacy Track projections for compatibility through #11.
- Explicitly out of scope:
  - Auto-pick, result reconciliation, week closure, buyback, guided repairs,
    admin undo, season completion, or rollover.
  - Changing the shared-password admin identity or associating an admin with a
    User.
  - Replacing browser-owned result processing before #11.
- Affected workflows: User profile Pick selection, final submission, league
  visibility, stale-page refresh, and legacy result compatibility.

## Behavior

- Draft selections live only in page memory and disappear on refresh or close.
- The review dialog lists every active Track and selected Team, identifies
  missing/invalid choices, displays **Are you sure? You will not be able to
  change your Picks after submitting.**, and offers **Go back and edit** and
  **Submit and lock Picks**.
- A final request supplies Track-to-Team selections, never a User ID or required
  Track list. The server derives the authenticated User and required active
  Track set from the locked open League Season.
- Eligible Teams are the validated active-week schedule participants minus all
  Teams previously selected by that Track in the League Season.
- The deadline is the earliest kickoff in the validated active-week schedule.
  Submission at or after the deadline fails.
- Missing, extra, eliminated, foreign, stale, reused, unscheduled, late, or
  invalid selections reject the entire request with safe per-Track errors.
- A successful submission immediately locks normalized Picks. Exact retries
  return the existing committed success; any differing retry returns a conflict.
  Concurrent submissions commit at most one selection set.
- If a Week-1 Track is created after a User submitted, existing Picks remain
  locked, the User becomes incomplete again, and only the new Track is editable.
  A subsequent complete request must exactly match prior Picks and add the
  missing Pick atomically.
- A User may see current Pick identities only when every active Track has a
  normalized current-week Pick or when the User has no active Tracks.
- Before eligibility, all Users' current-Pick Teams, IDs/logos/odds associations,
  and Pick-derived statistics are omitted. Picks-submitted status, rankings,
  User names, Tracks remaining, and non-Pick statistics remain visible.
- When eligible, current Picks are visible and missing Picks are explicitly
  `NOT_SUBMITTED`. Response state distinguishes `HIDDEN`, `VISIBLE`, and
  `NOT_SUBMITTED` without placing hidden identities in response data or DOM.
- Personalized responses use `Cache-Control: private, no-store`. Fresh browser
  responses replace previously rendered state.

## Interfaces and data

- Add authenticated routes under a purpose-specific User league boundary:
  - `GET` submission state for the authenticated User and current League Season.
  - `POST` one final complete submission.
  - `GET` eligibility-aware league view.
- Unauthorized requests return a safe `401` before target lookup.
- Add nullable `schedule_hash` to normalized Pick rows in a forward-only
  migration. Existing and backfilled Picks remain valid with `null`.
- Do not add a User-week submission table. Pick uniqueness, origin,
  `committed_at`, and schedule hash provide the commitment record; eligibility
  is intentionally derived from the current active Track set.
- Submission writes normalized Pick rows plus matching legacy Track
  `current_pick`, `used_picks`, `available_picks`, and `state_version`
  projections in the same transaction.
- Normalized Picks are authoritative. Ordinary legacy projection writes cannot
  replace or erase them and are never used for authorization or visibility.
- General User/Track responses stop exposing raw current-Pick identities or
  sensitive User fields to ordinary consumers. Known shared-admin/manual repair
  capabilities remain until their guided #12B replacements exist.

## Design

- A Fixture Download client fetches the active year and normalizes/validates the
  requested week outside database transactions.
- Every final submission requires a fresh valid fetch, persists an immutable
  Schedule Snapshot/hash, and fails closed on unavailable or invalid schedule.
  Profile display may use the latest stored valid snapshot.
- Pure modules own schedule eligibility, complete-set validation, visibility,
  and safe response projection.
- An application service owns the serializable transaction, League Season and
  Track locks, stale revalidation, normalized Pick creation, idempotent replay,
  and legacy projection writes. It does not import Express.
- Express adapters own session authorization, request/response mapping, and
  no-store headers. Browser modules own draft state and accessible DOM behavior.

## Safety and delivery

- User identity comes only from `req.session.user_id`; localStorage and request
  User IDs are never authorization evidence.
- Schedule fetch/validation occurs before acquiring database locks. The
  transaction binds the persisted hash to the locked League Season/week.
- Transactions use serializable isolation and row locks. Existing Pick unique
  constraints enforce one Pick per Track/week and no Team reuse per Track/year.
- Responses exclude passwords, email addresses, sessions, raw models, and
  hidden Pick-derived values.
- The migration is additive. The prior app ignores `pick.schedule_hash`, and
  rollback remains compatible.
- Existing result processing temporarily updates legacy Track projections so
  weekly behavior remains functional until #11 replaces it.

## Verification

- Confirmed test seams:
  - pure schedule/selection and visibility functions;
  - submission application service;
  - authenticated HTTP response contracts;
  - disposable-MySQL atomicity, rollback, retry, concurrency, and uniqueness;
  - profile and league page-entry behavior.
- Cover one/multiple active Tracks, mixed active/eliminated Tracks, no active
  Tracks, new Track after submission, stale week, foreign/extra/missing/reused
  selections, deadline equality, invalid schedule, exact/different retry,
  concurrent submission, and injected mid-write failure.
- Cover eligible/ineligible response shapes, all alternate ordinary endpoints,
  stale tab/refresh/localStorage behavior, no-store headers, review copy,
  cancel/focus behavior, loading state, and safe retry.
- Run unit, coverage, browser lint, disposable-MySQL integration, browser smoke,
  and `git diff --check` before publishing.

## Decisions and open questions

- Resolved:
  - Schedule failure fails submission closed.
  - Raw-data bypasses close in #13.
  - Exact retry succeeds; differing retry conflicts.
  - Weekly eligibility excludes bye Teams and uses one earliest-kickoff deadline.
  - Personalized responses are private/no-store.
  - Late Week-1 enrollment makes the User incomplete without unlocking Picks.
  - Every submission fetches fresh schedule evidence before its transaction.
  - Pick rows receive schedule hashes; no separate submission table exists.
  - Legacy Track projections update transactionally but are not authoritative.
- Open questions: none.

## Completion

- Implementation and the complete local PR gate passed on 2026-08-01:
  - `npm run test:unit` — 89 passed;
  - `npm run test:unit:coverage` — 89 passed, 83.09% line coverage;
  - `npm run lint:browser` — passed;
  - `npm run test:integration` — 14 passed against disposable MySQL;
  - `npm run test:smoke` — 7 passed;
  - `git diff --check` — passed.
- Update issue #13 and add PR/deployment evidence after publication and merge.
- Residual risk: browser result processing remains projection-based until #11;
  the normalized Pick record prevents it from changing submitted truth.
- Next safe step: merge, verify the automatic Heroku migration and production
  health, then begin #19 from fresh `main`.
