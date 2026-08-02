# Change contract: Zero-Track onboarding

Confirmed: 2026-08-02

## Problem and outcome

- An authenticated User with no current-League-Season Tracks currently sees a
  vague, hard-coded Venmo message and may be redirected away from it.
- After rollover, zero Tracks is a normal enrollment state. Give that User a
  clear, private, accessible payment/contact panel driven by authoritative
  server state and validated public-safe configuration.

## Scope

- In scope:
  - replace the existing zero-Track message on the profile page;
  - return onboarding presentation only in the authenticated submission
    response and only when the User owns zero current-season Tracks;
  - validate configured US phone numbers and a matching Venmo handle/profile;
  - share one enrollment policy between onboarding and admin Track creation;
  - enforce the known Week 1 kickoff boundary at admin preview and confirmation;
  - add an authoritative Refresh Tracks action and responsive accessible styles;
  - document configuration, behavior, privacy, and administration.
- Explicitly out of scope:
  - collecting, storing, or confirming payment in the application;
  - background polling, automated Track creation, international phone support,
    or changes to buyback payment handling;
  - exposing configuration on public or unauthenticated routes.
- Affected workflow: authenticated profile onboarding and shared-admin Track
  creation. Admin remains separate from User authentication.

## Behavior

- A User with zero Tracks owned in the open League Season remains on the
  profile page and sees onboarding. Any owned Track, including an eliminated
  Track, suppresses the panel.
- Enrollment is open during Week 0 and during Week 1 when the first kickoff is
  unknown or in the future. It is closed at/after a known first kickoff, after
  Week 1, or outside an enrollable League Season state.
- Open copy states that Tracks cost $5 each, offers a matching Tate Venmo
  action, offers “Text Tate for help” and “Text Andrew for help,” and explains
  that manual Track creation may take time after payment.
- Closed copy omits the payment invitation and Venmo action, says enrollment is
  closed, and retains valid help contacts.
- Refresh Tracks refetches authoritative state. There is no background polling.
- Missing/invalid individual options are omitted. If none are valid, show:
  “You don’t have any Tracks for this League Season. Contact a league organizer
  for help joining.”
- Loading and request failure never render onboarding. A failed refresh retains
  a safe error state rather than inventing zero Tracks.

## Interfaces and data

- `GET /api/user/league/submission` may include `onboarding` only for its
  authenticated session User when that User owns zero Tracks in the open
  League Season.
- The object contains only public presentation values, enrollment state, and
  valid action URLs. It contains no User ID, payment state, or unrelated config.
- Production configuration:
  - `ONBOARDING_TATE_PHONE`
  - `ONBOARDING_ANDREW_PHONE`
  - `ONBOARDING_VENMO_HANDLE`
  - `ONBOARDING_VENMO_URL`
- Price is fixed application policy: USD $5 per Track. Display names are Tate
  and Andrew.
- US numbers accept ten digits or `+1` plus common punctuation, render as
  `(###) ###-####`, and link as `sms:+1##########`.
- Venmo accepts only an exact matching `@handle` and
  `https://account.venmo.com/u/<handle>` pair with no query or fragment.
- No migration or stored-data change is required.

## Design

- A pure onboarding configuration module validates environment-derived values,
  builds sanitized presentation, and reports only invalid setting names.
- A pure enrollment policy consumes League Season state, current time, and the
  earliest known Week 1 kickoff.
- The league service queries all owned current-season Tracks to decide
  onboarding, while continuing to expose only active Tracks for Pick submission.
- Admin action preview/confirmation obtains the same schedule/deadline context
  and reruns the shared policy while holding the League Season lock.
- A focused browser onboarding module owns DOM rendering; the profile entry
  coordinates loading and refresh without adding DOM behavior to data modules.

## Safety and delivery

- User middleware authorizes before configuration or Track state is returned.
- Personal phone numbers exist only in deployment configuration and the exact
  authenticated zero-Track response that needs them. They are never committed,
  documented as literals, or logged.
- Invalid configuration logs one sanitized startup warning containing setting
  names only. The application continues with valid options or safe fallback.
- Venmo opens with `noopener noreferrer`; actions are semantic links with
  useful accessible names and visible phone numbers.
- Admin Track creation rechecks the known deadline at confirmation. Week 1
  remains open when schedule/kickoff is unavailable, by explicit decision.
- Rollout requires setting all four production config keys before merge.
  Verification may inspect key names only, never values.
- Ordinary application rollback applies; no migration or data rollback exists.

## Verification

- Test-first pure tests cover phone normalization, Venmo matching, partial and
  total fallback configuration, enrollment boundaries, and presentation.
- HTTP/service tests cover authentication, zero/active/eliminated Tracks,
  current-season scope, Week 0/Week 1/closed states, failure behavior, and
  refresh semantics.
- Admin integration tests cover future, missing, reached, and stale-confirmation
  kickoff behavior using a disposable MySQL schema.
- Browser tests cover accessible links, secure Venmo attributes, exact copy,
  closed state, fallback, loading/error behavior, refresh, keyboard semantics,
  narrow layout, and absence from public pages.
- Run the complete repository PR gate with no skips before publishing.

## Decisions and open questions

- Resolved decisions are recorded above.
- Open questions: none.
- The owner configured production values directly in Heroku and did not expose
  phone numbers in chat or source.

## Completion

- Update behavior, operations/admin, security/privacy, route, and configuration
  documentation plus the Issue #15 handoff/tracker state.
- Residual risk: a missing Week 1 schedule intentionally leaves enrollment open.
- Next safe step: implement test-first, pass the complete gate, publish a focused
  PR, and verify the exact merged Heroku release and production health.
