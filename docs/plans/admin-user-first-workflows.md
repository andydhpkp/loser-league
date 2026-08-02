# Change contract: User-first admin workflows

## Problem and outcome

- The admin page is an endlessly scrolling collection of forms that require internal User, Track, Pick, operation, and state-version identifiers.
- Admins generally know which User needs help, not database identifiers.
- Replace raw-identifier entry with focused, responsive workflows that expose recognizable Users, Tracks, Picks, matchups, and operations for selection.

## Scope

- In scope: Admin Home navigation, per-User changes, transactional bulk Track creation, Week and League Season tools, buyback management, statistics, contextual help, and responsive presentation.
- Explicitly out of scope: prior League Seasons, changes to league rules, payment processing, User-facing pages, and unrelated admin API contract changes.
- Affected workflows: shared-admin operations in the current League Season.

## Behavior

- Admin Home presents five choices: Make Changes for a User, Add Tracks in Bulk, Manage Week and League Season, Manage Buybacks, and View Statistics.
- One workflow is visible at a time with Back to Admin Home. Logout remains at the bottom.
- Each workflow has an accessible, scrollable contextual Help dialog. Every
  dialog explains purpose, appropriate use, numbered steps, each available
  action, confirmation results, stale-data handling, warnings, and inappropriate
  uses in phone-readable sections. The permanent long-form guide is removed.
- User selection searches full names and usernames without displaying internal IDs.
- The selected User workspace shows current-season Track cards labeled by User-facing ordinal, status, current Pick, Week 1 result, and used Teams. Selecting a Track reveals only applicable actions.
- Track/Pick/Team operations use visible selection controls. Internal identifiers and state versions remain hidden payload details.
- Per-User changes include quantity-based Track creation, User buybacks, wins, repairs, and a collapsed deletion Danger Zone.
- Bulk Track creation shows every User with one quantity field, accepts whole numbers from zero through 100 per User, previews the complete batch, and commits all requested Tracks in one transaction or none.
- Week/Season tools use scheduled-matchup selection, visible winner Track selection, and a collapsed Advanced League Repairs section.
- Buybacks remain available per User and in a cross-User queue; raw direct-buyback inputs are removed.
- Statistics is a separate read-only workflow.
- Current data is refreshed when a workflow opens and before mutation preview. Stale selections fail safely with plain-language guidance.
- Only the current League Season is exposed. “Historical Pick” means an earlier week in the current League Season.

## Interfaces and data

- Preserve existing admin mutation APIs where their contracts fit the new UI.
- Add current-season workspace/read APIs only where existing responses do not expose safe selection data.
- Add one admin-authorized transactional bulk Track endpoint accepting `{ additions: [{ userId, quantity }] }` with quantities capped at 100.
- No migration or stored-data shape change is required.
- Browser modules continue to call shared HTTP/admin action seams; server modules retain domain and transaction ownership.

## Design

- Admin Home and workflow sections live in `public/admin.html`; the page entry owns navigation and event binding.
- Focused browser rendering/data functions live in the admin browser module and do not depend on global state.
- Server routes parse authenticated input; an application service validates the open League Season and performs the atomic batch transaction.
- Existing action previews/confirmations remain the mutation seam for individual actions.
- No ADR is required because dependency direction and established interfaces are preserved.

## Safety and delivery

- Every read and write remains protected by shared-admin authentication.
- Raw IDs are hidden from presentation but validated and authorized on the server.
- Bulk creation locks/validates its targets and uses one transaction. Invalid Users, quantities, League Season state, or stale data produce no writes.
- Secrets and personal fields beyond the existing admin scope are not added to responses.
- Rollback restores the previous admin markup/page entry and removes additive endpoints.

## Verification

- Browser smoke tests cover Admin Home navigation, responsive User selection, Track-card selection, contextual help, absence of raw-ID inputs, bulk preview, and statistics isolation.
- Unit route/service tests cover admin authorization, normalization, quantity limits, invalid Users, and all-or-nothing behavior.
- Integration tests cover transactional multi-User Track creation against a disposable test database.
- Run unit coverage, browser lint, integration tests, and the complete browser smoke suite before PR creation.

## Decisions and open questions

- Resolved: responsive list/workspace navigation; current season only; visible selectors; contextual help dialogs; dedicated and per-User Track/buyback paths; atomic bulk creation; 100-Track per-User cap; preserved APIs where possible.
- Open questions: none.
- External dependencies: a disposable `TEST_DATABASE_URL` remains required for integration verification.

## Completion

- Update admin operations documentation and route documentation for additive endpoints.
- Residual risk: this touches a broad legacy admin module; browser tests must protect existing operations during decomposition.
- Next safe step: add red browser and HTTP tests before implementation.
