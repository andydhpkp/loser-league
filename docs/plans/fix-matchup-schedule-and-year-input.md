# Change contract: Fix matchup schedule and admin year input

## Problem and outcome

- ESPN redirects later weeks from the retired schedule JSON URL to HTML, so
  the matchup page receives a safe `502`.
- The admin winner form uses a number input and displays spinner controls even
  though a League Season year is a four-digit identifier.
- Matchup records must load again, and admins must type a four-digit year
  without spinner controls.

## Scope

- Fetch ESPN's current scoreboard JSON and normalize it to the existing
  `/api/nfl/schedule` response contract.
- Derive the matchup record year from the League Season fixture.
- Render the admin year field as numeric-entry text with a four-digit pattern.
- Do not change matchup selection, winner storage, crown rules, dependencies,
  models, schemas, or migrations.

## Behavior

- `/api/nfl/schedule` continues returning `content.schedule[date].games`.
- Weeks 1–18 use ESPN season type 2. Weeks 19–22 use season type 3 with the
  postseason week offset.
- The admin input has no spinner, requests a numeric keyboard where supported,
  and retains validation before submission.
- Existing validation and safe upstream errors remain unchanged.

## Interfaces and data

- The route and response contract remain compatible; only the fixed upstream
  URL and server normalization change.
- No model, migration, authentication, or stored-data changes.

## Design

- The ESPN client owns its upstream URL and response normalization.
- The matchup page derives the year from its fixture and uses the existing NFL
  browser data module.
- Admin page code continues to own its form controls and validation.

## Safety and delivery

- ESPN receives only server-validated year and week data.
- Rollback is a revert. Safe `502` behavior remains the fallback.

## Verification

- Unit tests cover the scoreboard URL, normalized response, and week mapping.
- Browser smoke tests cover the spinner-free four-digit input.
- Run the full required PR gate before handoff.

## Decisions and open questions

- The user explicitly requested both changes in the current work rather than
  separate pull requests.
- No open questions.

## Completion

- Update NFL data documentation for the current upstream and normalized
  response contract.
- Residual risk: ESPN's public response shape may change again.
