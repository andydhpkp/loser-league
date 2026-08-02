# Authenticated User navigation

The User session is the authority for authenticated pages and APIs.
`localStorage` values are not login evidence.

Successful login and registration land on `/dashboard.html`. The dashboard
shows a minimal server-authoritative League Season summary and links, in order,
to View League, Make Picks, and Help. Pick status comes from the server; the
browser only formats the ISO deadline in the User's locale and time zone.

`/help.html` explains active User-facing Pick, visibility, elimination, and
Week 2 buyback rules and loads sanitized configured support contacts. Phase 1
contains no Text Pick Reminder control or Help copy. Issue #45 owns that later
workflow.

Dashboard, Help, matchup, and league pages provide Home and Logout controls.
Dashboard and Help return to login when the User session is absent or expires.
