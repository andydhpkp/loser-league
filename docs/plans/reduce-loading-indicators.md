# Change contract: Reduce loading indicators

## Problem and outcome

- The loading indicators introduced by PR #72 make routine pages visually busy,
  especially the Dashboard where several nearby statuses animate at once.
- Loading spinners are reserved for the whole-matchup load, whose page-blocking
  workflow assembles several required data sources before the Pick interface is
  usable.
- Other existing loading states return to concise text-only status feedback.

## Scope

- In scope:
  - Retain the accessible Pick matchup spinner and reduced-motion behavior.
  - Remove spinners from Dashboard, Help contacts, Pick Reminder Settings, and
    admin status and game-odds loads.
  - Remove the shared loading-indicator module and generic spinner styling.
  - Retain Help's Bootstrap-styled **Open Pick Reminder Settings** navigation
    call to action.
- Explicitly out of scope:
  - Adding, removing, or restyling any other control.
  - Changing loading messages, retry behavior, pending-action behavior, routes,
    APIs, schemas, authorization, League rules, Pick rules, or reminder delivery.
- Affected workflows are presentation-only. Users, Tracks, and League Seasons
  are unchanged.

## Behavior

- The Pick matchup page continues to show its existing decorative Bootstrap
  spinner beside accessible loading text until its established terminal state.
- The matchup spinner remains hidden from assistive technology and stops
  animating when reduced motion is requested.
- Dashboard, Help contacts, Pick Reminder Settings, and admin loading regions
  display only their existing concise status text.
- **Open Pick Reminder Settings** remains an `<a href>` with Bootstrap button
  styling because it is a prominent navigation call to action.
- Existing success, empty, error, redirect, and retry behavior remains invariant.

## Interfaces and data

- Routes, methods, response bodies, models, migrations, stored data, external
  systems, and consumers are unchanged.
- Existing element IDs, status text, and link destinations remain stable.

## Design

- `matchup-page-state.js` directly owns its focused loading indicator again.
- `.matchup-loading-spinner` directly owns its presentation and reduced-motion
  rule.
- The generic loading-indicator module is deleted because it would have only one
  remaining caller and no longer hides shared implementation complexity.
- No ADR is required.

## Safety and delivery

- Authentication, authorization, input handling, secrets, and personal-data
  handling are unchanged.
- No migration or staged rollout is required. Rollback is a revert of this
  corrective browser-only change.
- No observability changes are required.

## Verification

- Browser regression tests assert that the matchup is the only application
  loading state with a spinner and that the Help call to action remains a
  Bootstrap-styled link.
- Existing matchup smoke tests continue to cover completion, failure, retry,
  mobile layout, and reduced motion.
- Run `npm run test:unit`, `npm run lint:browser`, and `npm run test:smoke` during
  development. Run the complete documented PR gate before creating the PR.
- No live-data checks are required.

## Decisions and open questions

- Resolved with the User on 2026-08-14:
  - Only the whole-matchup loading workflow retains a spinner.
  - All other PR #72 spinners return to text-only statuses.
  - The generic spinner abstraction is removed.
  - Help's **Open Pick Reminder Settings** button-styled link remains.
- No open questions or external dependencies remain.

## Completion

- Mark the earlier standardization contract as superseded by this focused visual
  policy.
- Residual risk is limited to accidentally retaining a generic spinner outside
  the matchup state; the browser regression audit covers that boundary.
- Next safe step: update the regression tests, implement the removal, and run
  browser verification.
