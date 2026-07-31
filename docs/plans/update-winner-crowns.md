# Change contract: Model-owned winner crowns

## Problem and outcome

- The league table currently chooses crowns in browser code from a User's raw
  `user_record`, and it only recognizes tied wins.
- A first-time solo winner must receive the new
  `first_time_solo_winner_crown.png` artwork without hard-coding a person's
  name.
- Crown classification must be easy to extend as new career win combinations
  and matching artwork are introduced.

## Scope

- In scope:
  - Derive a stable crown type from each User's complete win history in the
    User model.
  - Expose the derived crown type in serialized User responses.
  - Render the first-time solo winner crown and the existing first-time tied
    winner crown in the league table.
  - Centralize win-record mutation in `User.addWin()` and make the existing
    add-win route delegate to it.
  - Strictly validate add-win input.
- Explicitly out of scope:
  - Updating Lorna Durham's or any other production User's stored win record.
  - Adding admin UI controls for recording solo or tied wins.
  - Adding or changing server-side admin authorization.
  - Adding artwork for career combinations other than one solo win or one tied
    win.
- Affected Users, Tracks, League Seasons, and workflows:
  - All Users may receive a derived crown type from historical League Season
    wins. Tracks and Pick behavior are unchanged.
  - The league table displays artwork only when the derived type has a mapped
    asset.

## Behavior

- User-visible behavior:
  - A User with exactly one solo win and no tied wins displays
    `first_time_solo_winner_crown.png`.
  - A User with exactly one tied win and no solo wins displays
    `first_time_tie_crown_2_people.png`, renamed from `silver-crown-1.png`.
  - Other win combinations display no crown until matching artwork is added.
- Acceptance criteria:
  - Crown selection never depends on a User's name.
  - The User model returns `solo_1`, `tied_1`, or a deterministic identifier for
    any other non-empty career combination.
  - Serialized User data includes the virtual `crown_type` attribute without a
    stored database column.
  - Adding a valid win updates `user_record`; the derived crown type reflects
    the updated record.
  - The browser maps supported crown identifiers to assets and accessible alt
    text; unsupported identifiers render no image.
- Failure and edge cases:
  - Missing or empty win history yields no crown type.
  - Records not marked as wins do not contribute to crown classification.
  - `year` must be a four-digit integer. When supplied, `won_with_tie` must be
    a Boolean; omission retains the existing solo-win default. Invalid requests
    return HTTP 400 without writing.
  - Repeating the same annual win is idempotent. A later tied submission
    upgrades a solo record for that year; a later solo submission does not
    downgrade a tied record.
- Invariants that must remain true:
  - A User has at most one win record per year.
  - Crown type is derived from stored win history and is never independently
    persisted.
  - Existing User, Track, Pick, and league-table ordering behavior remains
    unchanged.

## Interfaces and data

- Routes, methods, and response bodies:
  - `PUT /api/users/:id/add-win` retains its successful response contract and
    delegates mutation to `User.addWin()`.
  - Invalid win input returns HTTP 400.
  - Serialized User responses add the `crown_type` field.
- Pages and browser interactions:
  - The league table consumes `crown_type` instead of reimplementing win rules
    from `user_record`.
- Models, migrations, and stored data:
  - Add a Sequelize virtual attribute backed by centralized classification.
  - Keep `user_record` as the source of truth.
  - No migration is required because no stored schema changes.
- External systems and consumers:
  - No new external systems. Existing API consumers receive one additive
    response field.
- Compatibility expectations:
  - Route URL, method, successful response fields, and annual-win mutation
    semantics remain compatible.
  - Users with unsupported career combinations stop receiving the generic tied
    crown and display no crown until exact artwork exists, as explicitly
    approved.

## Design

- Proposed module boundaries and dependency flow:
  - User model owns deterministic career-record classification and mutation.
  - HTTP route owns validation and response mapping.
  - Browser presentation owns the crown-type-to-asset and alt-text mapping.
- Considered alternatives:
  - A stored crown column was rejected because it would duplicate derived
    state, require synchronization, and need a migration.
  - Name-based rules or production-data migrations were rejected because crown
    behavior must follow win history and production identities are not stored
    in this repository.
  - Co-winner count is not added to `user_record`; “2 people” describes the
    current asset rather than a model fact.
- Decisions still requiring an ADR:
  - None. This follows existing model, route, and browser boundaries.

## Safety and delivery

- Authentication and authorization:
  - The add-win route's existing authorization behavior is unchanged. Its lack
    of server-side admin authorization is a known risk to resolve before the
    planned admin controls are exposed.
- Input, secret, and personal-data handling:
  - Validate win input without logging request bodies or personal data. No
    secrets or production records are included.
- Migration and rollout:
  - Deploy as an additive model/API/browser change; no schema or data migration.
  - Separately update the verified production User ID and League Season win
    only after this change is merged and deployed.
- Rollback or recovery:
  - Revert the application and asset rename. Stored data remains compatible
    because crown type is virtual.
- Observability:
  - Preserve existing safe route error logging. No per-user crown logging.

## Verification

- Regression or characterization test:
  - Add failing tests for the first solo and first tied crown classifications,
    asset mappings, unsupported combinations, and add-win delegation.
- Unit tests:
  - Cover empty/non-winning records, solo/tied combinations, deterministic
    unsupported identifiers, idempotency, tied upgrades, and validation.
- Integration tests and disposable database:
  - Run the documented integration suite with a disposable database whose name
    contains `test` when `TEST_DATABASE_URL` is available.
- Browser smoke tests:
  - Run documented smoke checks because league-table rendering changes.
- Manual or live-data checks:
  - Do not access or change live data. Confirm renamed and new assets exist at
    their mapped repository paths.

## Decisions and open questions

- Resolved decisions:
  - Crown types represent complete career win history.
  - Unsupported types have no visual fallback.
  - `crown_type` is a model-computed Sequelize virtual attribute.
  - The existing asset is renamed to
    `first_time_tie_crown_2_people.png`; participant count is not modeled.
  - Production data, admin UI, and real admin authorization are follow-up work.
- Open questions:
  - None for this change.
- Owners or external dependencies:
  - A future change must design server-side admin authorization and controls for
    recording or correcting wins.

## Completion

- Documentation to update:
  - This change contract and relevant behavior/route documentation describing
    `crown_type` and add-win validation.
- Residual risks:
  - The existing add-win endpoint remains without a server-side admin
    authorization boundary until the approved follow-up.
  - Production User records must be updated separately using verified IDs and
    years.
- Next safe step:
  - Add failing tests before implementation, then run every applicable check in
    `docs/engineering/README.md`.
