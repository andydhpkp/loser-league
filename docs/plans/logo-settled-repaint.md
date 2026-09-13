# Change contract: One settled League logo repaint follow-up

## Problem and outcome

The remote User reports loaded, CSS-visible logos remaining blank after the
initial automatic repaint, including a snapshot after two minutes. The hidden
manual repaint made all logos visible and they stayed visible. The User then
confirmed that collapsing the diagnostic panel alone leaves the logos blank.
The User requested automatic recovery ("Do it"). These are controlled device
observations of a recovery, not proof of the underlying Safari cause.

## Scope

Add one bounded follow-up to the existing League repaint controller. Preserve
logo assets, sizes, downloads, fallback text, data and other pages. No public
controls, telemetry, dependencies, API or schema changes. The diagnostic panel
stays behind its existing opt-in link.

## Behavior

Keep the first viewport-aware pass. After eligible first-pass work drains,
leave a one-second quiet interval before beginning one follow-up pass. Every
image receives at most two automatic one-second transforms per page visit.
Initial work takes priority if more loaded images enter view. Follow-up batches
remain limited to eight images, use one shared timer and yield through animation
frames. Do not repaint failed, hidden, disconnected or out-of-area images.
Dispose all frames, timers and classes on pagehide; restore fresh processing on
persisted pageshow. No repeating polling or unbounded retry.

## Interfaces and data

No module API changes. The existing page entry owns lifecycle and the focused
repaint module owns scheduling. No migrations or external integration changes.

## Design

Retain observed images until their second pass. Track first-pass completion in
a WeakSet, prefer first-pass candidates, and wait once when transitioning to
follow-up work. Reset the quiet interval requirement after new first-pass work.
Alternatives: changing asset sizes is deferred; permanent transforms and
unbounded retries violate the existing performance constraints. The other
remaining explanations (synchronous style reads or trusted user interaction)
are not established and are not combined into this timing-only experiment.
No ADR is required for the reversible scheduling change.

## Safety and delivery

Use synthetic fixtures only; no new logs or data collection. Deliver through
the tested PR/main workflow. Rollback is a source revert through the same gates;
no data recovery is required. Do not call this a verified Safari fix until the
User confirms recovery on the affected phone.

## Verification

Add failing controller and page-entry tests before changing implementation:
second pass after a quiet interval, maximum two attempts, first-pass priority,
viewport gating, late loads and cleanup during the quiet interval. Keep the
existing batch limit, fallback, interaction and lifecycle checks. Run all five
PR gates from final committed source and supported Linux WebKit checks.

The real-device observation is the reproduction for this workaround. Local
pixel probes catch transient blanks but have not reproduced persistent failure;
unit/page-entry scheduling tests cannot prove Safari pixels. This is an explicit
limitation of the diagnosis feedback loop, not a claim of a red-to-green pixel
regression. The User's controlled panel-only comparison rules out that action
alone; timing remains a candidate to validate, not an established root cause.

## Decisions and open questions

Resolved with the User: automate the confirmed manual recovery, keep diagnostics
hidden, and preserve the bounded repaint approach. The quiet interval and one
extra attempt are conservative implementation choices. Open: whether timing
alone recovers this device without a user gesture or diagnostic style reads.
User owns final real-device observation; agent owns automated verification.

## Completion

Update docs/nfl-data.md and the earlier repaint plan. Report exact verification
and remaining device risk in the PR and handoff. No claim of guaranteed repair.

## Development evidence

- `node --test test/unit/league-logo-repaint.test.js`: four failures before
  implementation; eight tests pass after implementation and added boundary cases.
- `npm run test:smoke -- test/smoke/league-logo-paint.spec.js --grep 'automatically follows'`:
  failed before implementation with two class transitions instead of the required
  four (one pass instead of two). The initial test was corrected to scroll its
  fixture image into view before making that assertion.
- `npm run lint:browser`: passed during development.
- Baseline WebKit pixel probes: 11 initial blanks across three runs, none still
  blank after 12 seconds; three untouched 20-second runs and one untouched
  120-second run had no blanks. The latter matched 390x739 at DPR3. These are
  baseline reproduction attempts, not evidence of the new behavior fixing pixels.
- Final committed-source gates and supported WebKit results belong in the PR.
