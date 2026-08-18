# Change contract: Authenticated User dashboard

## Problem and outcome

- Successful User login and registration currently navigate directly to the Pick page, while `dashboard.html` is an empty placeholder.
- Replace that placeholder with the authenticated home for the active League Season, with concise server-authoritative status and navigation to the league, Picks, and Help.

## Scope

- In scope: protected dashboard and Help pages; login/registration redirects; one minimal dashboard API; Home and Logout navigation on authenticated User pages; responsive and accessible loading, partial, error, and retry states.
- Explicitly out of scope: SMS UI or copy, SMS delivery/settings, schema changes, league-rule changes, matchup redesign, and admin workflows.
- Existing authenticated direct links to the Pick and league pages remain supported.

## Behavior

- Dashboard actions are View League, Make Picks, Pick Reminder Settings, and Help in that order when effective access exists; otherwise the reminder action is absent.
- PR 1 replaces the dormant capability with server-computed
  `features.pickReminders`; effective-access Users see the final **Pick Reminder
  Settings** label in a disabled coming-later state while ordinary Users see no
  reminder action.
- The server returns the canonical Make Picks status code and label. Precedence is lifecycle unavailable; season not started/completed; no active Tracks; buyback blocked; submission closed; Picks required/all submitted.
- Schedule failure returns valid season and count data with a nullable deadline and explicit unavailable status. Failure to establish a trustworthy core summary returns an error.
- The browser formats the authoritative ISO deadline in its locale with a short time-zone name; an invalid value renders unavailable.
- Authenticated page headers and explicit Home actions link to `/dashboard.html`. Logout remains available.

## Interfaces and data

- `GET /api/user/dashboard` requires a User session and returns only League Season year/week/state, deadline availability/value, the active Track count, tri-state weekly Pick completion, canonical Pick action status, and feature capabilities.
- `/dashboard.html` and `/help.html` require a User session at the server page boundary. Expired API sessions return the existing safe unauthorized response and navigate to login.
- Help uses only sanitized configured authenticated contact options and contains no admin or reminder material.
- No models, migrations, or stored data change.

## Design

- A focused dashboard application/domain module computes the summary from models and lifecycle evidence without Express.
- A focused route adapter owns session authorization and response mapping.
- Dashboard and Help each have one page-entry module; DOM rendering and navigation stay in browser modules.
- The dashboard does not consume or duplicate the larger Pick-submission response.

## Safety and delivery

- Server sessions are the only identity authority; localStorage is neither read nor trusted for dashboard access or data.
- Responses are private and no-store and omit other Users, Track details, Picks, contact data, credentials, sessions, and admin state.
- Additive routes/pages can be rolled back by reverting the change. No migration or data recovery is needed.

## Verification

- Unit/HTTP tests cover protected page and API access, sanitized response mapping, summary states, partial lifecycle data, and session expiry.
- Browser tests cover redirects, loading/error/retry, action order, hidden reminder copy, localized deadline, Help content, Home/Logout, keyboard semantics, and narrow layouts.
- Run unit tests, coverage, browser lint, disposable-database integration tests, and browser smoke tests before PR creation.

## Decisions and open questions

- Resolved: separate Help page; dedicated dashboard endpoint; server-authored Pick status; partial lifecycle success; browser-local deadline; header plus explicit Home links; hidden reminder UI/copy with a false capability seam.
- Open questions: none.
- External dependency: issue #45 owns final production setup, controlled beta, and explicit public activation of Pick Reminders.

## Completion

- Update route contracts, architecture, authenticated behavior/navigation, and browser test documentation.
- Residual risk is limited to lifecycle evidence becoming unavailable; the explicit partial state prevents stale or fabricated deadline/status display.
- Next safe step: add failing tests, then implement the approved contract.
