# Change contract: Mobile workflow audit

Confirmed: 2026-08-02

## Problem and outcome

- Loser League is primarily used on phones, but the combined User and shared-admin workflows do not have one repeatable mobile acceptance contract.
- Audit current rendered states, fix responsive and accessibility defects that do not change product behavior, and add deterministic browser coverage proving that supported tasks remain readable, tappable, scrollable, and reachable on common phone layouts.
- Existing responsive CSS, viewport metadata, and feature-focused smoke tests establish partial coverage, but the smoke configuration has no mobile projects or shared overflow, reachability, focus, large-text, or touch-target assertions.

## Scope

- In scope:
  - authentication, onboarding, dashboard/help, matchup and Pick, League view, and shared-admin workflows currently implemented on `main`;
  - shared responsive primitives and focused page/component fixes;
  - deterministic mobile browser fixtures, layout contracts, screenshot artifacts, and documentation;
  - Chromium coverage at 320 x 568, 375 x 667, 390 x 844, and 412 x 915 CSS pixels;
  - representative short landscape, 200% root-font scaling, iPhone-sized WebKit, reduced-motion, keyboard/focus, and desktop-regression checks.
- Explicitly out of scope:
  - Google SSO until issue #18 is implemented;
  - league rules, authentication policy, payment processing, lifecycle behavior, admin authorization, a new UI framework, or broad visual redesign;
  - committed pixel-comparison screenshot baselines;
  - fixes that require product behavior changes or major component redesign without a separately approved linked issue.
- Affected workflows include every currently implemented User and shared-admin workflow listed in issue #43. Behavior transitions run at 390 x 844; reusable layout contracts exercise their rendered states at every required portrait width; the highest-risk states also run in short landscape and at large text.

## Behavior

- Supported portrait pages have no document-level horizontal scrolling. Genuine tables may scroll only inside a visibly intentional container.
- Text and media wrap or scale without clipping or overlap. Flex and grid children may shrink where required.
- Modal headings and actions remain reachable; long modal bodies scroll internally; opening, closing, confirmation, focus containment, and focus restoration remain usable.
- Primary controls, form controls, selectable Teams, Track headers, modal actions, and destructive actions have at least 44 x 44 CSS-pixel targets. Natural inline text links are permitted when separated and non-overlapping, with a 24 x 24 interaction area where practical.
- Short-height and focused-input checks keep the active input and continuation action reachable. Fixed or sticky content does not overlap page content or safe areas.
- Primary and destructive action meaning/order remains stable. Status, disabled, loading, error, pending, selected, eliminated, and focus states remain clear without depending only on color or hover.
- Desktop/tablet behavior and all server-authoritative domain rules remain unchanged.

## Interfaces and data

- Existing routes, methods, response bodies, page URLs, models, migrations, stored data, and external integrations remain unchanged.
- Browser test fixtures and page-state builders live under `test/` only. Production code has no test routes, runtime flags, or fixture awareness.
- Existing page entries retain DOM ownership; shared CSS owns general layout constraints and page-specific selectors own exceptional presentation.

## Design

- Playwright projects define required browser/viewport targets without duplicating behavioral test bodies unnecessarily.
- Reusable test helpers assert document overflow, visible/reachable controls, intentional table overflow, modal bounds/focus, and touch targets against deterministic mocked API states.
- Every workflow transition is exercised at the representative 390 x 844 viewport. Rendered-state layout contracts cover 320, 375, 390, and 412 pixel widths. High-risk modal, dense Track/table, short-landscape, reduced-motion, and 200% root-font states receive focused coverage.
- Chromium runs the full portrait matrix. WebKit runs one representative iPhone-sized project, and Chromium retains a desktop regression project.
- Screenshot capture is retained as Playwright audit/failure artifacts, not as brittle committed pixel baselines.
- No ADR is expected because this extends the existing native browser module and Playwright testing direction.

## Safety and delivery

- Fixtures and screenshots use synthetic identities, Tracks, Picks, contacts, and payment configuration only. They never use production or personal data.
- No secrets, sessions, request bodies, environment values, or live NFL/payment services are logged or captured.
- The change has no migration. Rollback is a revert of CSS/HTML/browser-test/configuration/documentation changes.
- If an audit finding requires changed product behavior or major redesign, record it here and ask for approval before creating a linked GitHub issue. Independent fixes continue.

## Verification

- Regression tests are added before responsive fixes and initially demonstrate the relevant overflow, target, focus, or reachability failure.
- Browser smoke tests cover the supported viewport matrix, representative WebKit, short landscape, large text, reduced motion, modal behavior, and desktop regression using deterministic local fixtures.
- Existing browser unit tests remain the seam for pure rendering/state behavior when appropriate.
- No integration or database behavior changes are planned. The complete repository PR gate is still required before any pull request, including disposable-MySQL integration tests.
- A real-device pass on an iPhone or Android phone is mandatory before issue completion and is owned by the user.

## Decisions and open questions

- Resolved on 2026-08-02: umbrella/follow-up boundary, real-device ownership, screenshot strategy, browser matrix, large-text method, touch-target standard, fixture isolation, non-Cartesian coverage strategy, documentation location, and approval boundary for linked issues.
- Open questions: none for implementation.
- External dependency: issue #18 remains open, so Google SSO mobile coverage is deferred.

## Completion

- Add `docs/engineering/mobile-browser-testing.md` with the permanent viewport matrix, fixture strategy, assertion guidance, and future-change checklist.
- Real-device verification record (must be completed by the user before closing #43):
  - Phone model and OS version: pending.
  - Browser and version: pending.
  - Portrait workflows exercised: pending.
  - Landscape workflows exercised: pending.
  - Text-size setting: pending.
  - High-risk screenshots and findings: pending.
  - Remaining device-specific limitations and linked follow-ups: pending.
- Residual risk remains until that real-device record is complete.
- Automated implementation verification on 2026-08-02:
  - `npm run test:unit` — 158 passed (required an unrestricted localhost binding because the sandbox rejects Supertest listeners);
  - `npm run test:unit:coverage` — 158 passed, 80.19% line coverage;
  - `npm run lint:browser` — passed;
  - `npm run test:integration` — 52 passed against the configured disposable test database;
  - `npm run test:smoke` — 114 Chromium tests passed across the four portrait widths, representative behavioral viewport, and desktop layout regression project;
  - focused `chromium-320` mobile contract — 15 passed;
  - `git diff --check` — passed before the final documentation/test expansion and must be rerun before handoff;
  - `npm run test:smoke:webkit` — blocked on this macOS 14 arm64 host because Playwright 1.62's frozen WebKit runtime rejects the `PushAPIEnabled` protocol setting; it must pass on a supported host before a pull request;
  - `npm test` — aggregate unit, disposable-database integration, and Chromium smoke suite passed;
- Next safe step: run the WebKit project on a supported host and complete the real-device record before a pull request or issue closure.
