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

## Remaining items requiring integration or live-data characterization

- Batch repair routes may leave partial updates when a later row fails.
- Browser smoke execution is pending outside the Codex desktop sandbox because
  its Chromium process exits with `SIGTRAP` before opening a page.
- Full MySQL route characterization requires a configured disposable
  `TEST_DATABASE_URL`.
- Commented Handlebars routes remain disconnected and are retained until page
  smoke and deployment checks confirm they are unnecessary.

Move an item to confirmed only when a test, browser trace, or direct interface
comparison demonstrates it.
