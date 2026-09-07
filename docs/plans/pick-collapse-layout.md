# Pick selection layout repair

## Scope and evidence

Localized `/profile.html` presentation repair requested by the User. The supplied
phone screenshot shows a distorted selected-Team helmet. A synthetic page-entry
regression selects the last matchup of a long Track and demonstrates that the
collapsed header remains outside the viewport in both motion modes.

## Expected behavior

Selecting a Team preserves its logo proportions inside the existing header logo
box, without flex shrinking. The Track still collapses and retains its pending
selection. Scroll the collapsed Track header into view with smooth movement, or
instant movement when reduced motion is requested. Keep the next Tracks available
below it. Selection does not submit Picks or change server rules.

## Implementation and delivery

Keep DOM behavior in `teams.js` and presentation in `styles.css`. No API, data,
authorization, dependency, or migration changes. Roll back the CSS and selection
scroll changes together if necessary. Tests use only synthetic data.

## Verification

Regression: `npm run test:smoke -- test/smoke/pick-collapse.spec.js`.
Run unit tests, browser lint, and the full browser smoke suite. Real-device Safari
verification remains a handoff check; desktop emulation does not establish it.

## Results

- Before the fix, both motion-mode regressions failed: the header was outside
  the viewport and the logo used `object-fit: fill`.
- `npm run test:unit`: 352 passed. The initial sandboxed run could not bind HTTP
  test ports; the unrestricted rerun passed.
- `npm run lint:browser`: passed.
- `npm run test:smoke`: 173 passed, including normal/reduced-motion selection
  checks at 320, 375, 390, 412, and 1280 pixels. A full-suite run exposed a
  fractional top-edge alignment issue; adding 16px scroll margin resolved it.
- `git diff --check`: passed.
- The initial DOM/CSS verification omitted database integration and coverage.
  The requested pull request requires the full gate against the committed source;
  record those results in the pull request before review. No deployment is included.
- Real-device Safari verification remains pending. Next safe step: review this
  branch and confirm the selection interaction on a phone before release.
