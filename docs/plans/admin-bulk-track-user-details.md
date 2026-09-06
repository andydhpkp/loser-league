# Change contract: Admin bulk Track User details

## Problem and outcome

- The Add Tracks in Bulk workflow currently renders Users in API order and does not show how many usable Tracks each User already owns.
- Admin should be able to scan Users alphabetically and see each User's active Track count before entering additions.
- Current behavior is established by `renderBulkUsers` in `public/js/modules/admin-workflows.js` and the bulk workflow browser test.

## Scope

- In scope: User ordering and active Track-count text in Add Tracks in Bulk.
- Explicitly out of scope: other admin User lists, Track creation rules, payment handling, API response changes, database changes, and League Season rules.
- Affected Users, Tracks, League Seasons, and workflows: every User shown to shared Admin in the current League Season's bulk Track workflow.

## Behavior

- User-visible behavior: bulk rows are ordered by displayed full name, case-insensitively, with username as a deterministic tie-breaker. Each row shows `1 active Track` or `<n> active Tracks` beneath the username.
- Acceptance criteria: alphabetical ordering is independent of API order; only Tracks without an eliminating Pick and without a Wrong Pick contribute to the active count; zero and singular/plural labels are correct; a successful addition refreshes the displayed counts from server-authoritative User data.
- Failure and edge cases: missing name components use the existing displayed-name behavior; equal displayed names sort by username; zero active Tracks displays `0 active Tracks`.
- Invariants that must remain true: bulk quantities, preview, confirmation, atomic creation, authorization, and enrollment validation are unchanged.

## Interfaces and data

- Routes, methods, and response bodies: unchanged; the existing authenticated `GET /api/users` Track collection supplies the count and `POST /api/admin/tracks/bulk` remains the mutation seam.
- Pages and browser interactions: `public/admin.html` continues to host the workflow; its browser module changes row presentation only.
- Models, migrations, and stored data: unchanged; no migration.
- External systems and consumers: none.
- Compatibility expectations: existing request and response contracts are preserved.

## Design

- Proposed module boundaries and dependency flow: keep sorting and rendering in the existing admin browser module; continue using the existing Track projection fields.
- Considered alternatives: server-side ordering/count aggregation was rejected because the required data is already present and this presentation is local to one workflow; sorting every admin list was rejected as outside scope.
- Decisions still requiring an ADR: none.

## Safety and delivery

- Authentication and authorization: unchanged; existing Admin-only reads and writes remain protected.
- Input, secret, and personal-data handling: no new data is requested or exposed.
- Migration and rollout: deploy with the existing static admin assets; no sequencing requirement.
- Rollback or recovery: revert the browser rendering, tests, and documentation.
- Observability: unchanged; this read-only presentation change adds no logging.

## Verification

- Regression or characterization test: browser smoke coverage supplies Users out of order and asserts alphabetical rows with zero, singular, and plural active counts.
- Unit tests: run the relevant admin browser unit tests.
- Integration tests and disposable database: no server/data behavior changes; existing integration coverage remains applicable.
- Browser smoke tests: run the focused bulk workflow smoke tests, followed by the relevant admin workflow suite.
- Manual or live-data checks: not required because deterministic browser fixtures cover the presentation.

## Decisions and open questions

- Resolved decisions: first-name-then-last-name ordering; case-insensitive comparison; username tie-break; active usable Tracks only; count beneath username; bulk workflow only.
- Open questions: none.
- Owners or external dependencies: none.

## Completion

- Documentation to update: this plan and `docs/operations/admin-access.md`.
- Residual risks: the legacy User response may contain both `tracks` and `Tracks`; the existing normalization helper continues to support both shapes.
- Next safe step: add failing browser coverage before changing rendering.
