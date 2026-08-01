# Behavior baseline

## Product

Loser League lets friends select one NFL team to lose for each active track
each week. A team cannot be reused on the same track. Users can register, log
in, create tracks, make picks, and compare league standings. Administrative
workflows maintain records, force missing picks, reset weekly state, and repair
historical pick data.

## Pages

- `/index.html`: login, password reset, admin access, and league initialization.
- `/create-account.html`: account registration.
- `/profile.html`: the logged-in user's tracks, weekly matchups, and pick entry.
- `/league-page.html`: standings and weekly statistics.
- `/admin.html`: user and track administration.

The refactor must not intentionally alter HTML structure, styling, visible
copy, navigation, or interaction outcomes.

## Authentication and session behavior

- Registration creates a user and stores a bcrypt password hash.
- Login validates username/password, stores `user_id`, `username`, and a logged
  in flag in the server session, and lets the browser retain its existing local
  storage values.
- Logout destroys the session.
- Password reset locates a user by email and stores a newly hashed password.

Passwords, session secrets, full request bodies, and credentials must never be
logged.

## League and track invariants

- A track belongs to one user.
- `available_picks` and `used_picks` are stored as semicolon-delimited text but
  are exposed by Sequelize as arrays.
- A submitted current pick moves through the established weekly workflows
  without changing successful payloads.
- Used picks must not silently return to availability except through an
  explicit reset or repair workflow.
- Wrong picks remain recoverable by the existing reset and repair operations.
- Force-pick work must not run concurrently and must not assign a team when no
  valid available pick exists.
- Force-pick cooldowns become active only after the corresponding database
  transaction commits successfully.
- Batch maintenance must either complete consistently or roll back when its
  multi-row mutation fails.

## External schedule behavior

- The server proxies the Fixture Download NFL feed.
- The server proxies NFL odds using the server-only `ODDS_API_KEY`; browser
  assets never contain the credential.
- The browser also uses ESPN data for scores, teams, and matchup details.
- External failures must produce a clear safe error while retaining enough
  context in a single server log for diagnosis.

## Characterization status

This baseline was derived from route, model, page, and browser-script inspection.
Executable characterization is added in the next stage. Any conflict between
this document and observed production behavior must be recorded in
`known-issues.md` before code is changed.

## Current weekly closure behavior

This section supersedes the historical browser-owned weekly mutation behavior.
Fixture Download defines the complete schedule and ESPN explicit terminal
status supplies results. One server transaction settles normalized Picks,
eliminates Tracks for selected winners or ties, clears current Pick
projections, records `CLOSE_WEEK`, and advances once. The League page only
colors terminal results. A shared admin may record an immutable official result
or manually close after every active Track's selected game is final; both use
registered preview/confirm actions and actorless audits.
