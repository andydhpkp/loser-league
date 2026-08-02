# Change contract: Accessible matchup loading state

## Problem and outcome

- The matchup page shows only a plain waiting heading while required data loads,
  can reveal partial UI, and can leave no recoverable inline state after failure.
- Users receive one immediate, accessible loading indicator until the complete
  matchup, valid empty, closed, onboarding, or Week 2 buyback-gated state is ready.

## Scope

- In scope: profile-page loading, valid empty, failure, retry, and duplicate
  initialization behavior; responsive and reduced-motion presentation; browser
  page-entry tests.
- Explicitly out of scope: matchup-card redesign, Pick or lifecycle rules,
  server routes, schemas, dependencies, and other pages.
- Existing Track selection, Pick review/submission, buyback, onboarding, and
  logout workflows remain compatible.

## Behavior

- A single polite status region immediately shows a centered Bootstrap spinner
  and “Loading this week’s matchups…”. The decorative spinner is hidden from
  assistive technology and stops rotating under reduced motion.
- Required Track/lifecycle, Fixture schedule, Team metadata, record, logo-image,
  and rendering work completes before the final UI is revealed.
- The page uses one staged UI commit. No partial matchup or action UI is visible.
- No scheduled matchups and zero Tracks without onboarding render dedicated
  valid empty states. Server-provided onboarding remains authoritative.
- Any required-data, malformed-response, missing-element, image, or render
  failure clears staged UI and shows one `role="alert"`: “Unable to load this
  week’s matchups. Please retry or refresh the page.” Technical detail remains
  in the browser logger.
- Retry clears stale output and reruns full initialization. Concurrent calls
  share one in-flight attempt; a later retry starts a new attempt.
- If the static state region is missing, initialization creates one under
  `main`, falling back to `body`.

## Interfaces and data

- `profile.html` owns the static page-state region; its page entry owns startup.
- Existing HTTP routes and response bodies are unchanged.
- No models, migrations, stored data, external consumers, or authentication
  behavior change.

## Design

- A focused browser page-state module owns loading, error, empty, and ready
  transitions and hides staged content until commit.
- `teams.js` continues to own matchup data and controls, but awaits every
  required dependency and propagates failure to the page-state boundary.
- No ADR is required; this follows the documented browser dependency direction.

## Safety and delivery

- User-facing errors are generic; request payloads, response bodies, personal
  data, and internal exceptions are not rendered.
- Rollout requires no migration. Rollback is a revert of the HTML, CSS, browser
  modules, tests, and this contract.

## Verification

- Browser tests cover immediate and delayed loading, success, onboarding and
  empty states, closed and buyback gates, request/malformed/render/image failure,
  retry, duplicate initialization, accessible announcements, reduced motion,
  responsive/large-text layout, and reveal timing.
- Run `npm run test:unit`, `npm run lint:browser`, and `npm run test:smoke` during
  development. Run the complete documented PR gate only if a PR is requested.
- Tests use controlled routes and data URLs, never live NFL or production data.

## Decisions and open questions

- All behavior and recovery decisions were confirmed with the user on 2026-08-02.
- No open questions or external dependencies.

## Completion

- This contract is the behavior documentation for the focused page-state change.
- Residual risk is limited to browser image-loading differences, covered by
  controlled smoke tests and generic retry recovery.
- Next safe step: implement test-first and run required browser verification.
