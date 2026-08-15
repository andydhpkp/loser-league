# Mobile browser testing

Loser League treats phone layouts as supported product behavior. Every User-facing or shared-admin change must preserve the mobile contracts below and add coverage for each new or changed rendered state.

## Automated viewport matrix

`npm run test:smoke` runs:

- Chromium at 320 x 568, 375 x 667, 390 x 844, and 412 x 915 CSS pixels;
- the complete behavior smoke suite at 390 x 844;
- the reusable layout regression suite at the existing 1280 x 720 desktop viewport.

The non-representative portrait projects run `mobile-layout.spec.js`, which applies the reusable page-shell, overflow, reachability, touch-target, modal, landscape, large-text, and reduced-motion contracts. This avoids multiplying every transition test across every viewport while still exercising every page and shared layout rule at each required width.

A supported Playwright host must also run the representative iPhone-sized WebKit project:

```sh
npx playwright install webkit
npm run test:smoke:webkit
```

The macOS 14 arm64 WebKit runtime frozen by Playwright 1.62 cannot currently start because its protocol does not support the `PushAPIEnabled` setting sent by that Playwright version. Run the WebKit gate on a current supported macOS or Linux host. The official Playwright Linux container is an acceptable fallback when it receives only an isolated disposable source copy and installs locked dependencies with lifecycle scripts disabled.

## Fixture strategy

Mobile smoke tests intercept same-origin API calls with synthetic deterministic responses from `test/smoke/support/mobile-contract.js`. Fixtures may use long names, many Tracks, large counts, and lifecycle/error states, but must never contain production Users, Tracks, Picks, contact details, payment details, sessions, or copied production responses.

Do not add production-only routes, browser flags, or runtime branches for smoke fixtures. Do not call live NFL, email, identity, payment, development-database, or production services.

## Required assertions

Screenshots alone are not acceptance evidence. For every new or changed state, assert the applicable observable properties:

- `document.documentElement.scrollWidth` does not exceed its client width in portrait;
- wide semantic tables overflow only inside the labeled, keyboard-focusable table region;
- visible content and actions stay inside horizontal viewport bounds;
- primary controls, form controls, selectable Teams, Track headers, modal actions, and destructive actions have at least 44 x 44 CSS-pixel targets;
- modal content is viewport-bounded, its body scrolls internally, focus stays inside, and closing restores focus;
- focused inputs and the continuation action remain reachable at a short landscape height;
- 200% root-font scaling does not clip content or create document overflow;
- reduced-motion emulation disables decorative motion;
- selected, disabled, loading, error, pending, eliminated, and focus states remain distinguishable without hover or color alone.

Playwright captures screenshots and traces only for failures. Capture additional screenshots for corrected high-risk layouts when useful during review, but do not commit platform-sensitive pixel-comparison baselines.

## CSS and markup guidance

- Fix shared primitives before adding page-specific overrides.
- Prefer wrapping, `min-width: 0`, bounded media, flexible grid/flex layouts, and intentional scroll containers.
- Keep tables semantic and preserve reading order.
- Bound modal content to the dynamic viewport and let the body scroll without moving the heading or actions out of reach.
- Do not introduce device user-agent checks, duplicated mobile-only markup, or JavaScript layout calculations when CSS can express the constraint.
- Preserve visible focus and meaningful labels when text wraps or an action is icon-sized.

## Real-device completion checklist

Automated emulation does not complete a mobile change by itself. Before closing a mobile umbrella issue or pull request, record at least one real iPhone or Android pass with synthetic or non-sensitive data:

- phone model and operating-system version;
- browser and version;
- portrait workflows exercised;
- landscape workflows exercised;
- system/browser text-size setting, including a large-text pass;
- on-screen-keyboard behavior for authentication and modal forms;
- screenshots for corrected high-risk layouts;
- device-specific limitations and linked follow-ups.

Never include personal User, Track, Pick, payment, contact, session, or production data in the record or screenshots.

## Checklist for future browser changes

For the hidden PR 3 PWA seam, verify manifest/icons, standalone detection, iPhone/iPad Home Screen guidance, Android install guidance, direct-gesture notification permission, denial recovery, update-ready signaling, user-initiated waiting-worker activation and reload, notification focus/open behavior, and an offline page with no authenticated content. Use controlled APIs and fake transport only.

For hidden PR 4, verify the public verification success/failure and neutral
opt-out landings at every portrait width, landscape, 200% text, keyboard focus,
reduced motion, and screen-reader heading/status semantics. Fixtures and traces
must contain no real or full destination, token, or provider response.

1. Identify every new or changed rendered state and transition.
2. Add deterministic behavior coverage at the 390 x 844 project.
3. Add or reuse a layout contract that runs at all four portrait widths.
4. Repeat high-risk dense, modal, focused-input, large-text, or motion states at their specialized seam.
5. Run focused tests during development, then all required repository checks before a pull request.
6. Complete and record the real-device pass when the change materially affects phone workflows.
## Hidden calendar contract

PR 5 adds reusable instruction/link content but no visible page. Smoke coverage
must continue to prove ordinary Users cannot discover a calendar control.
PR 6 must test the subscribe and copy-link controls on narrow, large-text,
landscape, keyboard/focus, and reduced-motion configurations without opening a
real calendar provider. Test `webcal:` conversion and clipboard behavior only
through controlled browser seams.
# Pick Reminder Settings

Include `/reminder-settings.html` in authenticated phone-width, landscape, large-text, zoom, keyboard-order, visible-focus, reduced-motion, wrapping, touch-target, and no-color-only checks. Exercise iPhone/iPad installation instructions in Safari, Android installation instructions in Chrome, unsupported desktop behavior, direct-gesture permission, partial channel failure, retry/session expiry, and service-worker update action without forced reload.
