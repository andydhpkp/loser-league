# Change contract: Resend verification email

## Problem and outcome

- A User with an unconsumed verification request sees only **Verification pending** until the request expires, even when the provider definitely rejected the email and no usable message exists.
- The existing verification endpoint enforces resend limits but the settings page hides its action during `VERIFICATION_PENDING` and exposes no retry timing.
- Give Users a discoverable, manually triggered resend action with an automatic countdown, while preventing duplicate or abusive delivery.

## Scope

- In scope: verified-email status, resend eligibility and supersession, rate-limit responses, the Pick Reminder Settings email card, and supporting tests/documentation.
- Explicitly out of scope: automatic resend, changing verification lifetime, changing Gmail credentials/breaker behavior, reminder delivery retries, new email destinations, and schema changes.
- Affected workflow: a User requesting or resending verification for the email already attached to their authenticated User identity.

## Behavior

- While an unconsumed potentially delivered verification is pending, show a resend action at all times.
- During a limit, disable the action and show a live `Resend available in` countdown. Enable it automatically at zero without a page reload.
- One potentially delivered request is allowed per ten minutes and five per rolling 24 hours. `ACCEPTED` and `UNKNOWN` results consume those limits because `UNKNOWN` may have been delivered.
- Definite `AUTHENTICATION_FAILURE`, `TEMPORARY_FAILURE`, and `PERMANENT_FAILURE` results do not consume resend limits and do not create a pending-verification presentation.
- A potentially delivered replacement supersedes every earlier unused request for that User. A definite failure preserves all earlier potentially delivered links.
- After an accepted or ambiguous send, show **Verification email sent. Check your inbox and spam folder. The link expires in 24 hours.** and restart the countdown.
- Resends are never automatic and never enable email reminders without successful token consumption.

## Interfaces and data

- Preserve `GET /api/user/reminders/email` and `POST /api/user/reminders/email/verification-requests` paths, authorization, empty mutation body, no-store caching, and masked destination.
- Extend email status with nonnegative integer `retryAfterSeconds` and boolean `hasPreviousRequest`; keep existing state values. `VERIFICATION_PENDING` means at least one unexpired, unconsumed, unsuperseded `ACCEPTED` or `UNKNOWN` request. The boolean lets the authenticated page distinguish first-send from resend copy after a definite failed attempt without exposing provider detail.
- Successful request responses remain HTTP 202 and include `state: "VERIFICATION_PENDING"`, `retryAfterSeconds`, and `message: "Verification email sent. Check your inbox and spam folder. The link expires in 24 hours."` for potentially delivered outcomes.
- Limited responses remain HTTP 429 with matching `Retry-After` and `{ state: "RATE_LIMITED", retryAfterSeconds }`.
- Definite failures return a safe temporarily-unavailable result without provider detail. The Gmail authentication breaker remains authoritative for subsequent readiness.
- Reuse `email_verification_request` timestamps/result/supersession fields; no migration or stored personal data is added.

## Design

- Keep rate-limit and supersession rules in `email-reminder-service`; Express maps the stable service result and the page entry module owns countdown DOM behavior.
- Reserve a request transactionally before provider handoff to preserve concurrency safety. Finalize its provider classification afterward; only potentially delivered finalization supersedes older usable requests.
- Count only potentially delivered results for rolling limits. In-flight `PENDING` rows still reserve capacity so concurrent calls cannot bypass limits.
- No ADR is required; this deepens the existing service contract without changing architecture or external provider choice.

## Safety and delivery

- Existing User-session and effective-access checks remain mandatory. The request accepts no User ID, email, token, or destination.
- Responses and logs expose no full address, token, provider response, counters, credentials, or request body.
- Rollout is an application-only forward change. Rollback restores the prior UI/service behavior; existing rows remain compatible.
- Keep sanitized verification classifications and rate-limit events for operations.

## Verification

- Add integration coverage for status/countdown boundaries, accepted and ambiguous limits, definite-failure exclusions, safe supersession, and concurrent reservation.
- Add route tests for extended status/success and stable 429 behavior.
- Add browser module/page tests for countdown formatting, automatic enabling, resend submission, and success copy.
- Run unit tests, unit coverage, browser lint, disposable-MySQL integration tests, and browser smoke tests before pull-request creation.
- Do not contact Gmail or use production data in automated tests.

## Decisions and open questions

- Resolved: ten-minute countdown; five potentially delivered sends per rolling day; ambiguous outcomes consume limits; definite failures do not; safe supersession; manual action only; agreed success copy.
- Open questions: none.
- External dependency: Gmail SMTP availability remains governed by the existing breaker.

## Completion

- Update the fixed verified-email contract and Pick Reminder operations documentation with resend semantics.
- Residual risk: an `UNKNOWN` send may not arrive, but delaying resend is safer than blindly duplicating a message that may have been accepted.
- Verification completed on 2026-08-14:
  - `npm run test:unit`: 291 passed.
  - `npm run test:unit:coverage`: passed at 91.24% line coverage.
  - `npm run lint:browser`: passed.
  - `TEST_DATABASE_URL=mysql://root@127.0.0.1:3306/loser_league_resend_full_test npm run test:integration`: 77 passed against a disposable local schema.
  - `npm run test:smoke`: 150 passed.
- Next safe step: review and publish the focused branch for pull-request validation.
