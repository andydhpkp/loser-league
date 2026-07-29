# Known issues

## Confirmed wiring defects

- Browser logout calls `/logout`, while the active server route is
  `/api/users/logout`.
- Two wrong-pick browser requests omit the `/api/tracks` prefix.
- Named team routes are declared after `/:id` routes for the same HTTP method,
  allowing `reset-records` and `team` path segments to be interpreted as IDs.
- `server/index.js` requires `node-fetch`, but it is not declared in
  `package.json`.
- Login code logs username/password input and the server logs a login request
  body.

## Suspected defects requiring characterization

- Duplicate `updateTrackPick` declarations in `app.js` cause the later function
  to replace the earlier one.
- Pages load scripts with unrelated DOM assumptions, which may create page-only
  runtime errors.
- Relative `api/...` URLs depend on the current page location.
- Batch repair routes may leave partial updates when a later row fails.
- The two model loaders are incompatible; only `my-index.js` appears active for
  routes while seed files use `models/index.js`.
- Commented Handlebars routes and browser-side `emails.js` appear disconnected.

Move an item to confirmed only when a test, browser trace, or direct interface
comparison demonstrates it.
