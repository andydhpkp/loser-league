# Authenticated User navigation

The User session is the authority for authenticated pages and APIs.
`localStorage` values are not login evidence.

The login page is served at `/` and `/index.html`. A valid server User session
redirects either URL to `/dashboard.html`; missing, expired, unsigned, or
malformed sessions remain on login. Autofilled fields and browser storage are
never treated as authentication evidence.

The login form exposes standards-compatible username and current-password
autofill metadata. Every successful User login issues a 180-day session cookie;
persistence is not a User-facing option. The cookie remains `HttpOnly`,
`SameSite=Lax`, and `Secure` in production. Logout destroys the server session
and clears the cookie.

Anonymous page and asset requests do not persist an empty server session.
Static assets never require session-store access. Routes that need User or
shared-admin authority load the same database-backed session at their protected
boundary, preserving authenticated redirects and authorization.

Successful login and registration land on `/dashboard.html`. A fresh login
may return to `/reminder-settings.html` only when that exact safe `returnTo`
value was supplied; arbitrary return values fall back to the dashboard. The
dashboard shows a minimal server-authoritative League Season summary and
links. With effective Pick Reminders access, their order is View League, Make
Picks, Pick Reminder Settings, and Help; without access the reminder action is
absent. The protected settings route is `/reminder-settings.html` and provides
Home and Logout. Pick status comes from the server; the browser only formats
the ISO deadline in the User's locale and time zone.

During Week 1 or later, View League is disabled until every active Track owned
by the User has a normalized current-week Pick. The league-view API enforces the
same rule before returning standings, so a direct League page visit returns to
the dashboard with an explanation. Users with no active Tracks may view the
League immediately, and Week 0 remains viewable because no Picks are due.

`/help.html` explains active User-facing Pick, visibility, elimination, and
Week 2 buyback rules and loads sanitized configured support contacts. Phase 1
contains no Text Pick Reminder control or Help copy. Issue #45 owns that later
workflow.

Dashboard, Help, matchup, and league pages provide Home and Logout controls.
Dashboard and Help return to login when the User session is absent or expires.

The installable shell starts at `/dashboard.html`. Protected navigation is network-first and an expired session follows the existing login redirect. The offline fallback contains no User or League data and cannot submit Picks or settings. PR 3 adds no public settings page.

PR 4 adds hidden authenticated email JSON routes but no settings page or
dashboard navigation change. Public verification and opt-out landing pages are
session-independent, neutral, uncached, and link only to login for management.
The PR 5 calendar API remains a hidden contract only. Do not add a dashboard,
settings, or Help link before PR 6. When PR 6 exposes it, discovery must use
the authenticated effective-access state and canonical server-returned URL;
possession of the public feed itself remains sessionless.
