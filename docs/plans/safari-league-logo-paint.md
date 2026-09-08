# Change contract: Bounded Safari League logo painting

## Problem and outcome

Safari sometimes leaves loaded League logos blank. The user confirmed a blank
image was complete, 2200 × 1700, and visible according to DOM/CSS checks. A
one-second `translateZ(0)` restored it and it remained visible after removal
and scrolling. Transforming the container did not work. These observations
establish a workaround, not the exact WebKit cause.

## Scope

Replace the unshipped permanent transform with temporary, viewport-aware
batches for League logos. Preserve image sizes, downloads, retries, fallbacks,
Pick data and other pages. No database, API, or asset changes.

## Behavior

Use one IntersectionObserver relative to the viewport with a 100px vertical
margin. Nested horizontal scroll clipping still applies. Only loaded, connected,
unhidden images intersecting this area are eligible. Apply a CSS class to at
most eight logos for one second, remove it, and start the next batch on a new
animation frame. One timer serves each batch. Process each image once per page
visit; images that leave the area while queued wait until re-entry. Late loads
remain eligible. Failed logos retain normal fallback behavior.

Dispose timers, animation frames, classes, observers and load listeners on
pagehide. Reinitialize existing logos when returning from the back-forward
cache. Without IntersectionObserver, skip the workaround and preserve normal
logo loading rather than transforming the whole table.

## Interfaces and data

A focused browser DOM module exposes observe(image) and dispose(). The League
page entry owns lifecycle events and passes image registration through the
League renderer. No route, stored-data, or shared logo-loader contract changes.

## Design

The user approved viewport-aware temporary batches after confirming a temporary
per-image transform and rejecting a container transform. Eight concurrent
transforms and the demonstrated one-second duration are conservative initial
implementation choices, not measured optimal values. No polling, per-image
timers, blanket permanent transforms, or attempted detection of unpainted pixels.
No ADR is required for this reversible browser-only workaround.

## Safety and delivery

No authentication or data changes, logging, or production-data tests. Deliver
through the normal tested deployment workflow. Rollback removes the page hook,
repaint module and CSS class. No deployment is implied by implementation.

## Verification

Failing tests before implementation cover bounded batches, viewport gating,
late loading, once-only processing and cleanup. Page-entry smoke tests use
synthetic 50-user × 20-Track data, real browser intersections and scrolling,
failed images, and page lifecycle. Run unit tests, browser lint, coverage and
browser smoke tests. Database tests are not applicable to this browser-only
change; all PR gates remain required before any PR.

Manual Safari testing must verify initial navigation and scrolling on desktop
and iPhone with a large table. Chromium cannot reproduce the actual paint bug;
the available local WebKit browser previously stalled on startup.

## Decisions and open questions

The user approved this approach and explicitly deferred oversized-image work.
The user prioritizes responsive scrolling and interactions over immediate
repainting; a queued delay of several seconds is acceptable. Test that animation
frames, wheel scrolling and the Stats interaction continue during batches.
The underlying Safari cause and measured device performance remain unknown.
Initial-load effectiveness is still to be verified in Safari; there is no
claim of guaranteed crash prevention or optimal performance.

## Completion

Update docs/nfl-data.md and record checks here. Residual risks: images may wait
for an earlier batch, Safari may repaint differently on initial load, and
observing 1,000 images still has a cost despite bounded active transforms.

## Verification results

- `node --test test/unit/league-logo-repaint.test.js`: three tests failed before
  the new module existed; all three passed after implementation.
- `npm run test:smoke -- test/smoke/league-logo-paint.spec.js`: before
  implementation, both viewport tests failed and fallback passed. Afterward,
  all three passed. The initial five-second assertion budget was too short
  for sequential batches; a 30-second queue-drain budget passed on both
  viewports. These are scheduling tests, not Safari paint verification.
- `npm run test:unit`: 355 passed.
- `npm run test:unit:coverage`: passed, 91.38% lines in the configured scope.
- `npm run lint:browser`: passed.
- `npm run test:smoke`: 176 passed.
- After the full suite, added the requested responsiveness test and ran
  `npm run test:smoke -- test/smoke/league-logo-paint.spec.js --grep 'scrolling, animation'`:
  one passed, confirming animation frames, wheel scrolling and opening Stats
  while the repaint queue is active. Application code was unchanged afterward.
- `git diff --check`: passed.
- Browser tests needed an outside-sandbox rerun for local server access.
  Database integration was not run because no server/data behavior changed.
  No PR or deployment was performed during implementation; the requested PR
  will record all gates against its committed source. Include the new tests in
  the representative WebKit project and use the documented isolated Linux
  container fallback for this Mac's unsupported runtime. Initial-load
  correctness and frame-time/memory performance on real
  desktop/iPhone Safari remain unverified.
