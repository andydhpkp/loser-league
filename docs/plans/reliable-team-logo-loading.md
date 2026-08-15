# Change contract: Reliable team-logo loading

## Problem and outcome

- On the League page, some Team logos intermittently fail to appear during the
  initial render and appear only after a full-page refresh.
- The current League renderer creates image elements from ESPN-hosted URLs but
  does not observe individual load, error, or timeout outcomes. The matchup
  renderer also uses ESPN-hosted logo URLs and rejects its staged render when
  any one logo fails.
- The exact production failure mechanism has not been established. Remote-image
  availability, caching, and image-event timing remain hypotheses rather than
  confirmed causes.
- Users should receive reliable initial League and matchup rendering from
  checked-in Team artwork. A failed individual image must degrade to its Team
  name without blocking other logos, the standings table, or matchup actions.

## Scope

- In scope:
  - Make the repository's checked-in artwork the canonical runtime source for
    all 32 current Team logos.
  - Add one shared browser resolver for canonical Team-name-to-logo paths.
  - Add one shared, independently testable image lifecycle that handles load,
    one automatic retry, a total timeout, and a Team-name fallback.
  - Adopt that resolver and lifecycle on the League and matchup pages.
  - Add deterministic regression and compatibility coverage at browser seams.
  - Document Team name and logo verification as part of League Season
    activation.
- Explicitly out of scope:
  - Automatically downloading or committing ESPN artwork.
  - Mutating repository files from a deployed application.
  - Changing ESPN Teams or Schedule routes or their response bodies.
  - Changing matchup selection, loading-indicator, Pick, standings, or result
    behavior beyond isolating logo failures.
  - Broad cleanup of the legacy Teams model or inactive logo fields.
- Affected workflows:
  - Authenticated Users viewing current Picks on the League page.
  - Authenticated Users viewing and selecting weekly matchups.
  - Operators activating each League Season and preseason.

## Behavior

- League and matchup logo images use same-origin, checked-in assets rather than
  ESPN image-CDN URLs during normal rendering.
- A logo cell or slot reserves its normal image space while loading. The Team
  name is not shown as a logo substitute during this state.
- Each logo is independent. Its first `error` outcome starts one automatic
  retry. The two attempts share one five-second total budget.
- A second failure or expiry of the five-second budget removes or hides the
  failed image and reveals the existing Team name as the fallback.
- A successful load displays the logo and keeps the fallback hidden. A load
  that completes after the fallback was shown may replace the fallback with
  the logo.
- A missing canonical mapping is a known failure, so it displays the Team name
  immediately without waiting five seconds or requesting an arbitrary remote
  URL.
- A missing mapping emits at most one sanitized browser warning for that render
  containing only the public Team name. It must not include image URLs,
  responses, sessions, request bodies, or User/Track data.
- One missing, failed, or timed-out logo must not prevent any other logo from
  rendering, prevent the League table from appearing, or prevent matchup
  controls from becoming usable.
- Logo images have useful Team-specific alternative text. The visible Team
  name remains the accessible fallback when an image is unavailable.
- Existing League ordering, Pick visibility, result coloring, matchup loading,
  used-Team state, and Pick submission behavior remain unchanged.

## Interfaces and data

- Routes, methods, and response bodies: no changes. `GET /api/nfl/teams`
  remains available for public Team metadata and the activation audit, while
  these renderers no longer need that response to discover image URLs.
- Pages and browser interactions:
  - `public/js/modules/league-rendering.js` delegates logo resolution and image
    lifecycle handling rather than appending unobserved ESPN images.
  - The matchup renderer in `public/js/teams.js` uses the same local resolver
    and treats per-image failure as a rendered fallback, not a rejection of the
    entire staged matchup render.
  - A focused browser module owns logo resolution and per-image lifecycle;
    page/rendering modules continue to own their DOM structure and events.
- Models, migrations, and stored data: none.
- External systems and consumers:
  - ESPN remains the metadata provider through existing same-origin routes.
  - ESPN's image CDN is removed from these two runtime image paths.
- Compatibility expectations:
  - Existing page URLs, APIs, response shapes, selectors used by active tests,
    and Pick workflows remain compatible.
  - The canonical manifest covers the 32 current Team display names returned by
    the ESPN Teams response and points to files under
    `public/css/assets/logos/`.

## Design

- Add a canonical Team-logo manifest keyed by the exact normalized display
  names consumed by the current browser flows. Keep paths root-relative so the
  same asset URL works from both pages.
- Put a maintenance note beside the manifest pointing operators to the
  League Season activation checklist in `docs/nfl-data.md`.
- Add a small browser logo module with a narrow interface that:
  - resolves a public Team display name to a local asset path;
  - coordinates the first attempt, one retry, and a five-second total timer;
  - reports loaded or fallback state without knowing League-table or matchup
    structure; and
  - accepts image creation and timer dependencies at the test seam.
- Keep page-specific DOM ownership in the existing League and matchup
  renderers. They supply the existing Team-name element and logo slot, then
  apply the shared module's outcome.
- Ensure retry creates a fresh image request while retaining the same canonical
  local asset identity. Clean up timers and obsolete attempt listeners, retain
  only the guarded load path needed for the confirmed late-success behavior,
  and prevent late events from duplicating nodes or warnings.
- Considered alternatives:
  - Continue using ESPN image URLs with retry: rejected because normal page
    rendering would retain the intermittent external dependency despite having
    all current artwork checked in.
  - Show Team names during every image load: rejected because the confirmed
    behavior requires the name only after failure or timeout.
  - Fail or delay an entire page until every logo succeeds: rejected because
    individual image failures must be isolated.
  - Automate artwork synchronization during activation: deferred because a
    running deployment should not rewrite versioned assets and a safe update,
    review, and commit workflow requires a separate change contract.
- No ADR is required; this is a focused browser reliability change using the
  documented dependency direction.

## Safety and delivery

- Authentication and authorization: unchanged. Existing authenticated page and
  API enforcement remains authoritative.
- Input, secret, and personal-data handling:
  - Treat ESPN display names as untrusted lookup keys and assign visible text
    through text properties, never HTML.
  - Do not construct filesystem paths from unmatched input.
  - Warnings contain only the unmatched public Team name.
- Migration and rollout: no schema or stored-data migration. Deploy the code and
  checked-in assets together.
- Rollback or recovery: deploy the previous application version. No data repair
  is needed.
- Observability:
  - Missing manifest entries produce one safe warning per Team per render.
  - Ordinary image retry, timeout, and fallback behavior does not log User or
    Track context and must not create unbounded log noise.

## Verification

- Regression or characterization test:
  - At the League browser/page-entry seam, deterministically simulate one logo
    failing its first and retry attempts while neighboring logos load.
  - Assert that the table and successful logos render, the failed logo retries
    once, no fallback name appears while either attempt remains within budget,
    and the failed cell reveals its Team name after terminal failure.
  - Simulate a never-settling image with controlled timers and assert the Team
    name appears at five seconds without affecting other cells.
- Unit tests:
  - Cover all 32 canonical Team names and assert every resolved root-relative
    asset exists in the repository.
  - Cover first-attempt success, first-error/retry-success, two errors, total
    timeout, late success, missing mapping, warning deduplication, and listener/
    timer cleanup.
  - Cover safe text assignment and Team-specific alternative text.
- Matchup compatibility tests:
  - Confirm local paths are used and one failed logo resolves to the existing
    Team-name presentation without rejecting or delaying the remaining staged
    matchup render.
  - Preserve existing loading completion, used-Team, selection, and submission
    behavior.
- Integration tests and disposable database: not required because no server,
  route, session, transaction, model, migration, or database behavior changes.
- Browser smoke tests:
  - Add or extend a focused Playwright case when it can deterministically
    intercept logo assets without shared data. Verify an individual asset
    failure does not block League or matchup interaction.
  - Run the existing matchup and authenticated navigation smoke coverage.
- Required development checks:
  - `npm run test:unit`
  - `npm run lint:browser`
  - Relevant focused smoke tests during implementation.
- Before any pull request, run every required check in
  `docs/engineering/README.md`, including unit coverage, browser lint,
  integration tests with a disposable `TEST_DATABASE_URL` whose schema name
  contains `test`, and browser smoke tests. A skipped or blocked check prevents
  pull-request creation.
- Manual verification:
  - Load League and matchup pages with normal network, one blocked local logo,
    and throttled image delivery. Confirm loading, retry, fallback, late-load,
    layout, and independent-render behavior without inspecting or recording
    authenticated payloads.

## Decisions and open questions

- Resolved decisions:
  - Issue #65 requires League reliability and includes matchup hardening through
    the same shared logo primitive.
  - Checked-in local artwork is the primary and only normal runtime logo source.
  - Show no Team-name substitute while loading.
  - Retry automatically once within one five-second total budget.
  - Use the Team name after terminal failure, timeout, or missing mapping.
  - Allow a late successful image load to replace the fallback.
  - Treat an unmatched ESPN Team as activation drift, warn safely, and do not
    silently use its remote image URL.
  - Document manual logo/name verification for every League Season activation.
  - Defer automated asset synchronization.
- Open questions: none.
- External dependency: ESPN Team display names remain metadata inputs and may
  change between League Seasons.

## Completion

- Documentation to update:
  - `docs/nfl-data.md` with the activation-time Team name/logo audit and the
    canonical manifest location.
  - This change contract if implementation evidence changes any assumption.
- Residual risks:
  - Checked-in artwork can become stale between activation audits.
  - A deployment or cache mismatch can temporarily make a manifest path return
    404; retry and Team-name fallback contain the user-visible effect.
  - The production-only intermittent mechanism may remain unproven after the
    external ESPN image dependency is removed; deterministic failure tests are
    therefore required to establish the new contract.
- Next safe step:
  - Write the failing League regression test, then implement the shared manifest
    and lifecycle module, migrate League rendering, and finally migrate matchup
    rendering under its compatibility tests.
