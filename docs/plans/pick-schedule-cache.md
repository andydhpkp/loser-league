# Change contract: Pick submission during schedule-provider outages

Confirmed 2026-09-24 in the incident conversation; expedited hotfix authorized.

## Problem and outcome

Every submission fetches the provider even when a validated schedule is saved.
Transport failures reproduce the reported “NFL schedule data is unavailable”
error. Submissions should use saved evidence without a provider request.

## Scope

Change only final Pick submission schedule loading. Preserve buyback decisions,
automatic Picks, closure, browser behavior, and existing refresh cadence.

## Behavior

Use the latest saved snapshot for the exact League Season, week, and provider.
Revalidate its games before use. A valid saved snapshot has no age expiry within
that week, as approved: rare corrections may remain unseen during an outage.
If no snapshot exists, retain the live fetch. Invalid saved evidence fails closed.
Preserve fixed regular/preseason deadlines, late Week 1 rolling eligibility,
atomic writes, ownership, prior-Team rules, and idempotency.

## Interfaces and data

No route, response, schema, migration, or browser changes. Reuse ScheduleSnapshot
and its original content hash as Pick evidence.

## Design

The application service reads persisted evidence; the NFL normalization module
revalidates it. Existing background refresh remains five minutes normally and
30 seconds near kickoff; no new timer or external integration is needed.

## Safety and delivery

Authentication, transaction locks, and deadline rechecks remain unchanged.
No production data or credentials are inspected. Roll back the code commit to
restore live-fetch requirements; stored Picks remain compatible.

## Verification

Regression: a saved schedule permits submission with a failing provider and
makes zero upstream calls. Cover missing/invalid evidence, provider/week scope,
preseason and late Week 1 deadline behavior, and actual database commitment.
Run unit, coverage, lint, disposable-database integration, and browser smoke.

## Decisions and open questions

The user accepted using the last validated weekly schedule during an outage.
Retain the existing faster refresh interval. No unresolved behavior decisions.

## Completion

Update route and operations documentation and supersede the original fresh-fetch
contract. Residual risk: a provider outage can delay discovery of a correction.
Next step: regression, implementation, full verification, and normal deployment.
