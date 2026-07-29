# Known issues

## Corrected defects

- Browser logout now calls `/api/users/logout`.
- Wrong-pick browser requests now include `/api/tracks`.
- Numeric ID constraints prevent named team and user routes from being
  shadowed.
- The server uses Node 22's built-in `fetch`.
- Login credentials and request bodies are no longer logged.
- Duplicate `updateTrackPick` declarations were separated by intent.
- The Monday completion flag typo and successful password-reset redirect were
  corrected.
- Force-pick completion no longer references an undefined `results` value.
- The previously browser-exposed Odds API credential was removed from tracked
  source; the server now reads its replacement from `ODDS_API_KEY`.

## Remaining items requiring integration or live-data characterization

- Batch repair routes may leave partial updates when a later row fails.
- The User add-win route continues its promise chain after returning its
  missing-User 404, dereferences the response object as an updated User, and
  attempts to emit a second response.
- The individual used-Pick reduction route continues its promise chain after
  its missing-Track 404 and already-short-enough 400 responses, then
  dereferences the response object and attempts to emit a second response.
- The league-page smoke scenario reaches the browser but throws
  `Cannot read properties of undefined (reading 'AwayTeamScore')`; the other
  four page-entry scenarios pass. Reproduce and characterize the missing score
  data before changing league rendering.
- Full MySQL route characterization requires a configured disposable
  `TEST_DATABASE_URL`.
- Commented Handlebars routes remain disconnected and are retained until page
  smoke and deployment checks confirm they are unnecessary.

Move an item to confirmed only when a test, browser trace, or direct interface
comparison demonstrates it.
