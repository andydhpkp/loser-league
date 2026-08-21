# Change contract: Reduce Papertrail log volume

## Problem and outcome

- Production Papertrail repeatedly exhausts the free `choklad` daily ingestion
  allowance while Loser League has only three preseason test Users. The
  aggregate Usage dashboard recorded 78.7 MB during the seven days ending
  August 21, 2026 and showed the daily graph at its apparent cap on six of the
  seven days.
- Once the allowance is exhausted, Papertrail drops new events and creates an
  observability gap for application errors, request failures, dyno failures,
  releases, and background coordinators.
- Reduce or safely exclude repetitive low-value events while preserving the
  records needed to diagnose application and platform failures. Produce the
  measured logging baseline and active-season capacity recommendation consumed
  by issue #85.

## Scope

- In scope:
  - sanitized aggregate Papertrail usage measurements;
  - an audit of application event frequency and density;
  - tests and focused changes for repetitive application logging;
  - narrowly evidenced proposals for excluding successful static-asset,
    routine-health-check, or automated-traffic Heroku router events;
  - owner-facing measurement, alerting, filter-canary, and rollback guidance;
  - preseason, active-season, and offseason volume budgets and Papertrail plan
    guidance for issue #85.
- Explicitly out of scope:
  - raw production log retrieval or storage;
  - automatic Papertrail filter, alert, or plan mutations;
  - traffic blocking or rate limiting;
  - Slack, webhook, or other new alert integrations;
  - league, Pick, reminder, calendar, or week-closure behavior changes;
  - seasonal shutdown/reactivation automation, which belongs to issue #85.
- Affected workflow: production logging, Papertrail ingestion monitoring, and
  seasonal capacity planning. No User, Track, or League Season behavior changes.

## Behavior

- User-visible behavior: none.
- Normal retained logging targets no more than 70% of the applicable daily
  allowance. Owner-email warning occurs at 70%; urgent escalation occurs at
  85%.
- Preseason acceptance requires seven consecutive uncapped days after the
  implemented changes.
- Active-season sizing uses these synthetic profiles with at least 2x headroom:
  - expected: 70 Users and 350 Tracks;
  - high: 70 Users and 700 Tracks;
  - stress ceiling: 70 Users and 1,400 Tracks.
- Remeasure during the first active-season week and revise issue #85's capacity
  recommendation when observed volume invalidates the model.
- Routine coordinator success events are retained only for a state change or
  non-zero aggregate work. Preserve startup/shutdown, warnings, failures,
  blocked-state transitions, recovery, and meaningful aggregate outcomes.
- Preserve application errors and warnings, Heroku error codes, failed and slow
  requests, dyno lifecycle failures, and release or migration failures.
- If automated traffic dominates, #86 may reduce ingestion of its low-value
  successful router events. Blocking or rate limiting requires a separate plan.

## Interfaces and data

- Routes, methods, response bodies, pages, browser interactions, models,
  migrations, and stored data remain unchanged.
- External systems: Heroku Logplex/router events and the Papertrail add-on.
- Production evidence is aggregate and sanitized. Do not retrieve, publish, or
  store raw production event content, credentials, sessions, request bodies,
  personal data, database URLs, provider values, or production records.
- Existing diagnostic event contracts remain compatible unless a tested change
  explicitly suppresses a repetitive success/no-op case defined above.

## Design

- Keep structured application logging in `server/lib/logger.js` and preserve
  the existing application/domain dependency direction.
- Measure scheduled application-event bounds independently from aggregate
  provider ingestion so application, router/platform, monitoring, and suspected
  automated-traffic volume can be distinguished without raw-event capture.
- Prefer denser aggregate application events over per-record or heartbeat output.
- Treat successful static-asset, health-check, and automated router events as
  filter candidates only after sanitized aggregate counts show material volume.
- Existing controller-local and centralized request error paths each log a
  failure once; broad error-path refactoring is not part of this change.
- No ADR is currently required. Record one only if diagnosis reveals a durable,
  surprising architectural trade-off.

## Safety and delivery

- Authentication and authorization behavior remains unchanged.
- The production owner is the sole approver for Papertrail filter creation,
  modification, rollback, alert configuration, and plan changes.
- Apply proposed production exclusion filters one at a time only after explicit
  approval. Each filter requires a 24-hour canary, a recorded pre-change
  baseline, protected-diagnostic validation, and a one-step rollback.
- This branch performs no Papertrail filter, alert, or plan mutation.
- Roll back application changes by reverting the release. Roll back a provider
  filter by disabling or deleting that exact approved filter after recording
  the action and confirming ingestion resumes.

## Verification

- Regression or characterization tests quantify scheduled application output
  and fail on the repetitive event pattern being removed.
- Add unit or integration tests at the stable logger, coordinator, or page-entry
  seam for every application logging behavior change.
- No database test is needed unless diagnosis identifies database-backed logging
  behavior; if required, use only a disposable `TEST_DATABASE_URL` whose schema
  name contains `test`.
- Run the complete repository gate before creating a pull request.
- Manual/provider checks use aggregate Usage metrics only:
  - initial baseline and time-to-cap;
  - highest-volume safely identifiable categories;
  - 24-hour before/after result for each approved filter;
  - seven consecutive uncapped preseason days;
  - first active-season week remeasurement.

## Decisions and open questions

- Resolved decisions:
  - code and documentation first; no automatic production mutation;
  - 70% normal budget, 70% warning, and 85% urgent escalation;
  - seven-day preseason observation window;
  - expected/high/ceiling profiles of 350/700/1,400 Tracks with 2x headroom;
  - first active-season week remeasurement;
  - state-change or non-zero coordinator success logging;
  - narrowly evidenced successful-router-event filter eligibility;
  - separate follow-up for traffic blocking/rate limiting;
  - one-filter-at-a-time 24-hour canaries;
  - production-owner email alerts only;
  - sole owner approval for every provider mutation.
- Open questions: the dominant ingestion categories and the exact active-season
  Papertrail tier remain evidence-dependent outcomes of diagnosis.
- External dependencies: Heroku, Papertrail/SolarWinds aggregate metrics, and
  issue #85.

## Completion

- Update the relevant logging ADR only if its permanent decision changes;
  otherwise update Heroku operations documentation and add a focused Papertrail
  runbook.
- Residual risk: preseason observations cannot prove active-season volume; the
  synthetic model and mandatory first-week remeasurement mitigate that gap.
- Next safe step: build and run the sanitized volume feedback loop, rank
  falsifiable hypotheses, and test them before selecting an implementation.
