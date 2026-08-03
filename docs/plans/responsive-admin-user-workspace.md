# Change contract: Responsive admin User workspace

## Problem and outcome

- Successful per-User admin mutations leave stale Track cards and actions, while Track creation refreshes the global list and loses the selected User context.
- Keep the selected User workspace open and reconcile it from server-authoritative state after every successful mutation.
- Consolidate selected-User loading from one global User request plus one request per Track into one targeted authenticated request.

## Scope

- In scope: selected-User workspace reads, per-User Track and win mutations, Track/User deletion, loading/error/success presentation, tests, and admin documentation.
- Explicitly out of scope: mutation semantics, database schema, League Season rules, non-User admin workflows, optimistic mutation, and background polling.
- Affected workflow: Make Changes for a User in the current League Season.

## Behavior

- Selecting a User performs one `GET /api/admin/users/:userId/workspace` request and renders that User plus current-season Track inspection views.
- A successful per-User mutation reloads that targeted workspace and keeps the User selected.
- The selected Track remains selected when it still exists. Deleting it removes its card, clears its action panel, and keeps the User selected with a success message.
- Mutation controls for the affected workspace are disabled while the request is active and an inline `Updating…` status is announced.
- A failed mutation restores controls, preserves User/Track selection, and presents a safe inline error.
- User deletion preserves the search query, returns to the filtered User list, removes the deleted User, and announces `User deleted.` without returning to Admin Home.
- No client-side mutation is treated as authoritative; successful state is re-read from the server.

## Interfaces and data

- Add authenticated `GET /api/admin/users/:userId/workspace`.
- Success returns a sanitized User summary and an ordered array of current-season Track inspection views.
- Missing/invalid Users return the established safe 404 interface. No email, password, session, secret, or new personal field is returned.
- Existing preview/confirm mutation interfaces remain unchanged.

## Design

- Deepen the existing inspector module with one User-workspace interface that owns User/current-season selection and reuses Track inspection rules internally.
- A focused Express adapter maps the authenticated route to that interface.
- The admin browser module owns selected User/Track identity, mutation loading state, targeted refresh, focus, and rendering.
- No ADR is required; dependency direction and existing seams are preserved.

## Safety and delivery

- Shared-admin authorization runs before workspace lookup.
- Server responses remain sanitized and browser errors remain safe.
- No migration or rollout sequencing is required.
- Rollback removes the additive route and restores the current global-plus-per-Track browser reads.

## Verification

- Unit tests cover current-season workspace aggregation, sanitization, ordering, invalid/missing Users, and route authorization/mapping.
- Browser smoke tests cover one targeted load, loading state, successful Track deletion with retained User, retained Track after mutation, failure preservation, and User deletion with preserved search.
- Run unit coverage, browser lint, integration tests with the disposable test database, and the full smoke suite before PR creation.

## Decisions and open questions

- Resolved: all per-User mutations refresh; server-authoritative targeted reads; selected Track preservation; Track/User deletion behavior; scoped disabling and inline statuses; one aggregate endpoint.
- Open questions: none.
- External dependency: disposable `TEST_DATABASE_URL` for complete verification.

## Completion

- Update the admin workflow plan, operations guide, route contracts, and architecture browser/server descriptions.
- Residual risk: several actions share one rendering module; smoke coverage must exercise both success and failure state transitions.
- Next safe step: add failing module, route, and browser tests.
