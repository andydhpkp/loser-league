# Change contract: Opt-in League logo diagnostics

## Problem and outcome

The User reports League logos staying blank for more than 20 seconds on both
Mac and iPhone Safari, with multiple refreshes eventually restoring them.
Production serves the merged repaint workaround. Synthetic WebKit runs captured
loaded-but-blank images, but all recovered within 12 seconds: 73 initial blanks
across 20 desktop loads and 34 across eight phone-density loads. These runs do
not reproduce the persistent reported failure.

Enable the remote User to capture the affected image's technical state from a
phone without developer tools. This is diagnostic preparation, not a logo fix.

## Scope

The User approved a temporary opt-in diagnostic mode for testing and review.
Only `/league-page.html?logoDiagnostics=1` enables the diagnostic UI. Normal
visits instantiate no diagnostic UI, observers, or image listeners. No logo
asset, loading, retry, fallback, repaint scheduling, API, or data changes.
Preparation alone did not authorize deployment. After reviewing the hidden-link
behavior, the User approved proceeding with normal tested deployment on
2026-09-13. There are no normal-navigation links to the mode; possession of its
URL is sufficient to open it, and it is not an account-restricted feature.

## Behavior

- A compact, collapsible phone-usable panel explains how to tap a blank logo.
- Tapping an image or its existing Team cell captures a report before updating
  the diagnostic panel. It does not transform, hide, reload, outline, decode,
  or otherwise repair the image, and does not change Picks.
- A selected image can be sampled again using Refresh report. Copy report
  copies the existing snapshot only on explicit action. When clipboard access
  fails or is unavailable, select the report for manual copying and explain it.
- Report only a schema/build marker, viewport dimensions/pixel ratio, elapsed
  observation time, image load/error counts and readiness, intrinsic/rendered
  dimensions, computed visibility/opacity/transform state, viewport/clipping
  visibility, and observed repaint starts/finishes.
- Never include image URLs, Team names, User/Track identifiers, Picks, page
  URLs/query strings, raw user-agent strings, API bodies, sessions, credentials,
  or surrounding DOM text. No storage, logs, or telemetry transmission.
- Explain that loaded state cannot establish painted pixels; the User identifies
  a visually blank image. Observation begins when this page's diagnostics start.
- No blank-image selection yet: show instructions and disable copy/refresh.
- Disconnect the diagnostic observer/listeners on pagehide. Recreate the panel
  and observation state on persisted pageshow, alongside the existing repaint
  controller lifecycle. A disconnected selection cannot be sampled again.

## Interfaces and data

Existing static page URL accepts an optional query flag; no server routes or
response contracts change. The League page entry owns event binding and page
lifecycle; a focused browser DOM module builds the panel and produces a strict
technical report. The existing renderer and logo loader remain unchanged.
No schema, authentication, external service, or stored-data changes.

## Design

Use delegated page-entry click/load/error bindings and one class mutation
observer only during opt-in visits. Keep per-image event history in a WeakMap;
only the selected image receives an on-demand snapshot. Do not continuously
poll or scan the whole table. Scope panel styles to diagnostics. No new runtime
dependency or ADR is needed for this removable diagnostic interface.

Alternatives: another speculative repaint change was rejected because the
persistent failure remains unreproduced; requiring desktop developer tools
would not work for the remote phone User. Automatic telemetry is unnecessary.

## Safety and delivery

The query flag is not an authorization mechanism; the report has no privileged
access and reads only the displayed image's technical state. Existing access
controls remain authoritative. No production data is used in tests. Remove the
entry hook, module, styles and tests to roll back; no migrations are required.
Test and review before any proposed deployment. Keep the mode opt-in throughout.

## Verification

Write failing page-entry smoke tests for flag gating, selecting a loaded image,
repaint history, failed-image selection, strict report fields/no fixture data,
clipboard success and denial, viewport bounds, 44px controls, and page lifecycle.
Run unit tests, browser lint, and the complete smoke suite. The normal project
WebKit gate is currently blocked by the Mac/runtime protocol mismatch; use the
isolated older WebKit diagnostic runner as supplemental evidence, clearly
separate from the required supported-runtime gate. No PR may be created until
all documented PR gates pass, including coverage and disposable-DB integration.

## Decisions and open questions

Approved: opt-in link, tap a blank logo, copy a technical report, no normal-visit
instrumentation, and subsequently normal tested deployment. Layout and
strict report fields above are implementation choices within that scope.
Still unknown: cause of the persistent Safari failure; effectiveness on the
User's exact devices until they can open a deployed, reviewed diagnostic link.

## Completion

Update docs/nfl-data.md with usage and limitations. Record exact checks here.
Deliver a reviewable diagnostic change, not a claim that logos are fixed.

## Verification results

- Before implementation, `npm run test:smoke -- test/smoke/logo-diagnostics.spec.js`:
  one flag-gating test passed; five diagnostic UI tests failed because the
  controls/report did not exist.
- After implementation, the same command: six passed. A first iteration of
  the history assertion sampled an offscreen image before it had entered the
  repaint queue; the test now scrolls it into view and waits for the actual
  repaint start and finish before checking the report.
- `npm run lint:browser`: passed after qualifying the browser URLSearchParams
  global. No lint rules were relaxed.
- `npm run test:unit`: 355 passed, zero skipped. The initial sandbox run failed
  HTTP tests with `listen EPERM`; the outside-sandbox rerun passed.
- `npm run test:smoke`: 183 passed, zero skipped (2.5 minutes).
- Supplemental WebKit: installed Playwright 1.58.2 and official WebKit 26.0
  build 2248 only under `/private/tmp/league-logo-webkit-probe`; copied the
  unchanged six diagnostic specs to its isolated test directory and ran
  `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/league-logo-webkit-probe/browsers node /private/tmp/league-logo-webkit-probe/node_modules/playwright/cli.js test --config /private/tmp/league-logo-webkit-probe/playwright.config.cjs`:
  six passed. This is not a pass of the project's supported-runtime WebKit gate.
- A separate synthetic phone preview passed and its screenshot was visually
  checked for readable report text and reachable copy/refresh controls.
- `git diff --check`: passed.
- Coverage and disposable-database integration were not run for this
  browser-only preparation. No PR, merge, or deployment was performed; all PR
  gates must run against final committed source before creating a PR.

Residual limitations: real-device Safari verification remains pending. Diagnostic
style reads and panel updates can affect timing or painting; failure to reproduce
with the mode enabled is not proof of repair. The report snapshots technical
state and cannot detect blank pixels. No forced repaint or speculative logo fix
was introduced.

## Approved follow-up: manual repaint experiment

The User supplied a second report for the same visually blank image after
120 seconds. It still reported successful loading, visible CSS and one completed
automatic repaint. A larger working logo had equivalent load/repaint state;
image dimensions alone do not distinguish success. This establishes a persistent
failure on the affected device, not its rendering cause.

The User approved adding **Repaint this logo** to the same hidden diagnostic
panel. This intentionally extends the earlier observation-only scope. Deliver
through the already-approved tested PR/main deployment workflow so the remote
User can perform the experiment from the same opt-in URL.

- Apply a separate diagnostic transform class to the selected, loaded, visible
  image for one second, then remove only that class. Never replace or remove
  the automatic repaint class, image source, visibility or inline styles.
- Disable the action without a usable selection, while the automatic repaint
  is active, and during a manual attempt. Run at most one manual attempt at a
  time. Ignore new image selections during that one-second attempt.
- Collapse the panel during the attempt so the User can inspect the image;
  show a completion message without claiming the pixels were repaired.
- Keep separate manual start/finish counts in the technical report, mark the
  manual class state, and advance the report marker to v2. Refresh the snapshot
  after the manual attempt; copying still occurs only on explicit action.
- Cancel the timer and remove the diagnostic class on pagehide/disposal.
  Back-forward restoration starts fresh diagnostic state as before.
- Normal visits remain unchanged and have no additional controls or observers.
  No asset resizing, extra downloads, polling, blanket transforms, telemetry,
  schema or backend changes.

Write failing page-entry tests for selection-only transformation, independent
automatic/manual counts, repeat-click guarding, no extra image request, cleanup
during the timer, and disabled failed-image action. Include the new button in
phone layout checks. Run all five PR gates from committed source plus the
supported Linux WebKit suite before PR creation. The experiment tests whether a
late manual repaint helps; it is not a proven fix for the persistent defect.

Follow-up development evidence: the first updated smoke run flagged four
missing v2/control/layout expectations; after implementation all eight then
present tests passed, including manual-only transformation, repeat guarding,
unchanged image source/request count and page-exit cleanup. Browser lint passed.
An additional overlap test covers refusing a manual attempt while the automatic
class is active. Final committed-source PR gate results are recorded in the PR.
