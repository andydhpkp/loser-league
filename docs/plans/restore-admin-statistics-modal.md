# Change contract: Restore the admin statistics modal

## Problem and outcome

- The user-first admin rewrite replaced the established weekly statistics modal with a separate workflow containing only User, total Track, and active Track counts.
- Restore the detailed weekly statistics in a popup modal opened from Admin Home.
- Repository history establishes the intended contents: Pick popularity, eliminated and remaining Users, remaining Tracks, Users with the most and least remaining Tracks, and an on-demand riskiest-Pick calculation from game odds.

## Scope

- In scope: the Admin Home View Statistics interaction, current-League-Season statistic calculations, the odds reload interaction, inline failure states, tests, and related admin documentation.
- Explicitly out of scope: admin mutations, league rules, stored data, schema changes, historical League Season reporting, and unrelated admin workflow changes.
- Affected workflow: shared-admin, read-only inspection of the current League Season.

## Behavior

- Selecting View Statistics opens a centered, accessible Bootstrap modal rather than navigating to a separate admin workflow.
- The modal displays Most Popular Pick, Least Popular Pick, Users Eliminated, Users Left, Tracks Left, User(s) With Most Tracks, and User(s) With Least Tracks.
- Pick popularity includes tied Teams and percentages of Tracks that currently have Picks.
- A User is eliminated only when the User has at least one current-season Track and every such Track is eliminated. A User with any active Track is left. Users without current-season Tracks are excluded from eliminated/left and most/least comparisons.
- Active Track calculations use the current elimination projections (`eliminated_by_pick_id` or `wrong_pick`).
- Empty collections render explicit zero or unavailable values rather than `NaN`, infinities, or blank labels.
- Reload Game Odds adds or updates a Riskiest Pick row containing the current Pick, spread, and all Users who made that Pick.
- Odds failure or a response with no matching current Picks produces an inline status while leaving the seven base statistics usable.

## Interfaces and data

- Preserve existing authenticated `GET /api/users`, `GET /api/admin/league-season`, and `GET /api/proxy/nfl-odds` contracts.
- `public/admin.html` owns static accessible modal markup; the admin page entry/browser module owns event binding and rendering.
- Filter Tracks by the current `league_season_id` returned by the existing League Season context. No route, model, migration, or stored-data change is required.
- The odds API remains hidden behind the existing server proxy.

## Design

- Add a focused browser statistics module with pure transformations for base statistics and riskiest-Pick selection.
- Keep modal navigation and network loading in `admin-workflows.js`; do not re-enable the legacy dynamic modal implementation.
- Preserve the documented browser dependency direction and current admin data seams.
- No ADR is required because this restores behavior within established boundaries.

## Safety and delivery

- Existing shared-admin authorization continues to protect every data request.
- Do not expose additional personal data, secrets, request bodies, or environment values.
- No migration or staged rollout is required.
- Rollback restores the current statistics workflow markup and three-card renderer.

## Verification

- Add browser-module unit tests for popularity ties, elimination semantics, current-season filtering, empty data, and riskiest-Pick selection.
- Add browser smoke coverage for modal opening, detailed rows, odds success, inline odds failure, and retained base statistics.
- Run unit tests and browser lint during implementation. Run the relevant admin smoke test when the browser runtime is available.
- Full unit coverage, integration tests with a disposable `TEST_DATABASE_URL`, and the complete smoke suite remain required before pull-request creation.

## Decisions and open questions

- Resolved: restore the complete historical modal; correct terminology and semantics; current League Season only; retain on-demand odds; fail inline without hiding base statistics.
- Open questions: none.
- External dependencies: live odds require the existing configured odds proxy; automated tests use deterministic fixtures.

## Completion

- Update the admin workflow plan and admin operations guide to describe the modal rather than a separate statistics workflow.
- Residual risk: legacy Track projections may represent elimination inconsistently, so tests cover both supported elimination fields.
- Next safe step: add failing pure-calculation and browser interaction tests before implementation.
