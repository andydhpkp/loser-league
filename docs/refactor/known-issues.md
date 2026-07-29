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
- The User add-win route now terminates its missing-User 404 path instead of
  continuing into the success handler and attempting a second response.
- The individual used-Pick reduction route now terminates its missing-Track
  404 and already-short-enough 400 paths instead of attempting second
  responses.
- League score rendering now tolerates an empty or incomplete schedule feed
  when checking whether the prior week's final game has completed.
- Resetting all NFL Team records now passes the model's array representation
  through its serializer instead of failing on a raw storage string.

## Remaining items requiring integration or live-data characterization

- Batch repair routes may leave partial updates when a later row fails.
- Full MySQL route characterization requires a configured disposable
  `TEST_DATABASE_URL`.
- Commented Handlebars routes remain disconnected and are retained until page
  smoke and deployment checks confirm they are unnecessary.

Move an item to confirmed only when a test, browser trace, or direct interface
comparison demonstrates it.
