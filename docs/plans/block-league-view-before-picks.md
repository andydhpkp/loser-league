# Change contract: Block League view before Picks

Confirmed: 2026-08-07

## Problem and outcome

- The dashboard always links to the League page, even when the authenticated
  User has not submitted a current-week Pick for every active Track.
- The league-view API currently returns standings with Pick identities hidden,
  so a direct URL still opens a partial League view.
- Users with Picks remaining must not enter the League view until every active
  Track has a current-week Pick. Users with no active Tracks may view it
  immediately.

## Scope

- In scope:
  - Disable the dashboard's View League control while access is blocked.
  - Reject direct league-view API access while blocked.
  - Redirect a blocked League page visit to the dashboard with an explanation.
- Explicitly out of scope:
  - Changing Pick submission, auto-pick, elimination, or result processing.
  - Changing League standings or Pick presentation after access is allowed.
  - Database or schema changes.
- Affected workflow: authenticated dashboard and League page navigation during
  Week 1 or later.

## Behavior

- During Week 1 or later, a User with at least one active Track may view the
  League only after every active Track has a normalized current-week Pick.
- Users with zero active Tracks may view the League immediately.
- Week 0 remains viewable because no Picks are due.
- The disabled dashboard control explains that all active Tracks require Picks.
- A blocked direct League page visit returns to the dashboard and displays:
  **Submit Picks for all active Tracks before viewing the League.**
- Existing authenticated-session requirements and allowed League responses
  remain unchanged.

## Interfaces and data

- `GET /api/user/dashboard` adds a server-authoritative League-view capability
  derived from the current submission state.
- `GET /api/user/league/view` returns a safe conflict response while blocked and
  no League standings or Pick data.
- `/dashboard.html` renders the View League control as disabled while blocked.
- `/league-page.html` redirects to the dashboard when the API reports the
  access conflict.
- No models, migrations, stored data, or external systems change.

## Design

- A pure Pick policy determines League-view eligibility from current week,
  active Track IDs, and current-week picked Track IDs.
- The application service enforces the policy before loading or projecting
  League Users and standings.
- The dashboard summary exposes the same capability from its already-loaded,
  server-authoritative submission state.
- Browser modules only render that capability and handle the safe API failure.
- No ADR is required; this deepens an existing authorization boundary without
  changing dependency direction.

## Safety and delivery

- The authenticated session remains the only source of User identity.
- The API fails before returning User names, standings, Pick identities, or
  Pick-derived statistics.
- Responses remain private and non-cacheable.
- Rollback is the code/documentation revert; no data recovery is required.
- No new secrets, personal-data logging, or observability events are needed.

## Verification

- Add pure policy tests for incomplete, complete, zero-active-Track, and Week 0
  access.
- Add service tests proving blocked requests fail before loading League Users
  and allowed requests preserve the response contract.
- Add route tests for the safe conflict response and no-store behavior.
- Add dashboard browser tests for enabled and disabled controls and direct-page
  redirect/message behavior.
- Run unit tests, unit coverage, browser lint, integration tests against a
  disposable test database, browser smoke tests, and `git diff --check`.

## Decisions and open questions

- Resolved:
  - Block the entire League workflow, not only the dashboard link.
  - Redirect blocked direct visits to the dashboard with explanatory copy.
  - Allow Users with zero active Tracks and all Users during Week 0.
- Open questions: none.
- External dependencies: a disposable MySQL test database may be required for
  the full integration gate.

## Completion

- Implemented and verified on 2026-08-07:
  - `npm run test:unit` — 203 passed;
  - `npm run test:unit:coverage` — 203 passed, 90.25% line coverage;
  - `npm run lint:browser` — passed;
  - `npm run test:integration` — 54 passed against the configured disposable
    test database;
  - `npm run test:smoke` — 128 passed;
  - `git diff --check` — passed.
- Updated authenticated User navigation documentation.
- Residual risk: browser navigation depends on JavaScript, but API enforcement
  prevents data disclosure even if the page redirect does not run.
- Next safe step: review and commit only the files belonging to this change,
  excluding unrelated worktree changes.
