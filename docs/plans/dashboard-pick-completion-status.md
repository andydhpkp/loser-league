# Change contract: Dashboard Pick completion status

## Problem and outcome

- The dashboard currently shows `Missing Picks: X`, which exposes a per-Track count that is not useful as a user-facing completion helper.
- Replace that count with a direct answer to whether the User has completed all required Picks for the current week.
- Existing dashboard policy and browser tests establish the current count-based behavior.

## Scope

- In scope: the authenticated dashboard API response, dashboard status copy, Make Picks status copy, tests, and dashboard documentation.
- Explicitly out of scope: Pick submission rules, Track status rules, league-view gating, other pages, stored data, and admin workflows.
- The change affects authenticated Users viewing the dashboard in any League Season lifecycle state.

## Behavior

- The dashboard continues to show `Active Tracks: X`.
- During an active weekly round, it shows `Picks submitted this week: Yes` only when every active Track has a submitted Pick, and `No` otherwise.
- It shows `Picks submitted this week: Not required` when there are no active Tracks, the League Season has not started, or the League Season is complete.
- The Make Picks status is `Submit this week's Picks` when Picks remain, `All Picks submitted` when complete, and `No Picks required` when there are no active Tracks.
- Existing lifecycle precedence and messages remain unchanged for unavailable lifecycle data, buyback blocking, and closed submissions.
- League-view gating remains based on all active Tracks having submitted a Pick.

## Interfaces and data

- `GET /api/user/dashboard` replaces `tracks.missingPicks` with `tracks.picksSubmitted`, whose value is `true`, `false`, or `null`.
- `null` represents a Pick status that is not required because there are no active Tracks, the season has not started, or the season is complete.
- `/dashboard.html` renders the new field and copy.
- No models, migrations, stored data, external systems, or integrations change.
- The intentional response-body break affects the dashboard browser module and repository test fixtures; they are updated atomically.

## Design

- The pure dashboard policy continues to derive the summary from authoritative submission state.
- The browser dashboard module maps the tri-state API value to `Yes`, `No`, or `Not required` without recalculating league rules.
- A boolean/nullable completion field was chosen over retaining an unused missing count so the API expresses the dashboard's actual user-facing question.
- No ADR is required.

## Safety and delivery

- Authentication, authorization, personal-data handling, and no-store response behavior are unchanged.
- No migration or special rollout is required because the only known consumer ships with the server.
- Rollback is a code and documentation revert; no data recovery is needed.
- Existing error handling remains unchanged.

## Verification

- Unit tests cover incomplete, complete, zero-Track, pre-season, and completed-season summaries and lifecycle label precedence.
- Dashboard service tests cover the new response field.
- Browser smoke tests cover Yes, No, and Not required rendering and the count-free Make Picks label.
- Run `npm run test:unit`, `npm run lint:browser`, and the focused dashboard smoke tests. Full pre-PR checks remain required before creating a pull request.

## Decisions and open questions

- Resolved: tri-state API contract; exact dashboard wording; count-free Make Picks wording; non-applicable lifecycle semantics; unchanged league-view gating.
- Open questions: none.
- Owners or external dependencies: none.

## Completion

- Update the authenticated dashboard plan to describe active count and Pick completion status.
- Residual risk is limited to any undocumented consumer of the intentionally changed dashboard response field.
- Next safe step: add failing tests, implement the policy and browser changes, then run relevant verification.
