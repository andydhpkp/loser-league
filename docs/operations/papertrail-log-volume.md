# Papertrail log-volume operations

Use this runbook to measure, reduce, and size production logging without
exposing production events or weakening failure diagnostics. Production
Papertrail filter, alert, and plan changes require the production owner's
explicit approval immediately before the mutation.

## Current baseline

As of August 21, 2026:

- Heroku reports the `papertrail:choklad` free plan attached to
  `loser-league`.
- The plan notification identifies a 10 MB daily ingestion allowance.
- Papertrail's aggregate Usage dashboard reported 78.7 MB for the preceding
  seven days and displayed six of seven daily points at the apparent cap.
- Only three preseason test Users were active. This is a low-load baseline,
  not an active-season capacity measurement.
- Papertrail grouped the entire 78.7 MB under the single `loser-league` log
  source. No production exclusion filters were configured.
- The application emitted an unchanged `reminder_evaluation_completed` event
  every 30 seconds while an automatic campaign already existed. The bounded
  event was 170 application bytes, or approximately 0.467 MiB/day before
  Logplex framing. That is real avoidable volume but cannot explain the full
  observed ingestion.

Do not download archives, export events, open individual event details, or
copy raw production log lines into an issue, plan, pull request, terminal
transcript, or documentation while following this runbook.

## Budgets and thresholds

For a plan with daily allowance `L`:

- normal retained volume: at most `0.70 * L`;
- warning threshold: `0.70 * L`;
- urgent threshold: `0.85 * L`;
- incident state: the provider reaches its limit or begins dropping events.

For the current 10 MB allowance, those thresholds are 7 MB and 8.5 MB.
Check **Logs > Usage** using a past-day and past-seven-days window. Treat a
flat-topped graph or a quota notification as censored data: it proves the
allowance was exhausted but does not measure the volume that was dropped.

SolarWinds flood detection is a separate spike signal. It evaluates ingestion
over the preceding 10 minutes rather than cumulative daily use. Configure it
only as an owner-approved supplement to the daily thresholds. Do not represent
a 10-minute flood threshold as a 70% or 85% daily-quota alert. The production
owner receives email notifications; Slack, PagerDuty, and webhooks are out of
scope for issue #86.

References:

- [SolarWinds log flood detection](https://documentation.solarwinds.com/en/success_center/observability/content/configure/configure-log-flood-detection.htm)
- [SolarWinds log exclusion filtering](https://documentation.solarwinds.com/en/success_center/observability/content/settings/log-filtering.htm)
- [Heroku Papertrail add-on](https://devcenter.heroku.com/articles/papertrail)

## Safe category measurement

The free log-only Usage dashboard reports bytes by log source, not Heroku
program or HTTP category. Do not work around that limitation by retrieving raw
events.

Application releases containing the issue #86 instrumentation emit at most one
`request_volume_completed` event per active hour per web dyno. It contains only:

- the fixed one-hour interval length;
- total completed requests;
- counts for `static`, `health`, `api`, `page`, and `other` requests; and
- counts for informational, successful, redirection, client-error,
  server-error, and unknown status classes.

It never contains URLs, query strings, route parameters, IP addresses, user
agents, request or response bodies, headers, sessions, request IDs, User IDs,
or other personal values. Compare these aggregate counts with the same hour's
aggregate Papertrail bytes:

- high `static` counts support a successful static-router filter candidate;
- high `health` counts support a successful routine-health filter candidate;
- high `other` plus client-error counts suggest automated traffic, but issue
  #86 must not block or rate-limit it;
- low application request counts with high Papertrail bytes point to platform,
  lifecycle, or traffic that did not complete through the application;
- coordinator events remain a separate application category and should be
  bounded statically by their documented schedules.

The aggregate event is diagnostic instrumentation, not proof of a category by
itself. Record only counts, totals, dates, durations, and conclusions.

## Measurement sequence

1. Record the exact attached Papertrail plan name using
   `heroku addons --app loser-league`. Do not retrieve configuration values.
2. In **Logs > Usage**, record total bytes and whether the graph is capped for:
   - the past day;
   - the past seven days; and
   - representative quiet and active intervals.
3. Record aggregate `request_volume_completed` counts by category and status
   class without copying any surrounding production event.
4. Bound scheduled application output from code and deterministic tests.
5. Rank application, Heroku router/platform, monitoring, and suspected
   automated traffic using only those sanitized aggregates.
6. After an application-only change, observe seven consecutive preseason days.
   Success requires every day to remain below the cap and normal days to remain
   at or below 70%.
7. During the first active-season week, repeat the measurement and revise the
   issue #85 plan recommendation if observed traffic exceeds the model.

Record a before/after table like this without raw events:

| Window | Plan | Total MB | Capped? | Static | Health | API | Page | Other | 4xx | 5xx |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Before | choklad |  |  |  |  |  |  |  |  |  |
| After | choklad |  |  |  |  |  |  |  |  |  |

## Filter proposal and canary

Do not create a filter until aggregate evidence identifies a material,
low-value category. Never use a broad rule that removes all router, application,
warning, error, or HTTP events.

An acceptable proposal must state:

- the exact successful event category and why it is low value;
- the aggregate count and estimated bytes during a named window;
- the exact POSIX-compatible string or regular expression;
- examples described structurally, not copied from production;
- the protected negative cases that must not match;
- the expected volume reduction; and
- how to disable or delete that exact filter.

Protected negative cases include application warnings and errors, HTTP 4xx/5xx,
Heroku error codes, timeouts, slow requests, dyno crashes/restarts, release and
migration failures, and meaningful coordinator failures or recovery.

After the owner approves the exact filter:

1. Record the current past-day aggregate and protected diagnostic checks.
2. Create one disabled filter and review its scope.
3. Obtain final owner approval, then enable only that filter.
4. Run a 24-hour canary.
5. Confirm aggregate volume changed as predicted and interactively verify the
   protected controlled diagnostic events remain searchable. Do not copy their
   raw content into the record.
6. Disable the filter immediately if protected diagnostics disappear, volume
   changes unexpectedly, or the rule matches an unapproved category.
7. Retain the filter only after recording the sanitized before/after result.

## Active-season capacity for issue #85

Model these profiles:

| Profile | Users | Tracks | Purpose |
| --- | ---: | ---: | --- |
| Expected | 70 | 350 | Initial paid-tier sizing input |
| High | 70 | 700 | Headroom validation |
| Stress ceiling | 70 | 1,400 | Safety boundary, not routine billing assumption |

Use at least 2x headroom above the measured expected retained daily volume.
Select the smallest current Papertrail tier whose allowance keeps that value at
or below 70% of capacity and whose retention meets operational needs. Do not
name or purchase a tier from stale documentation: verify current Heroku plan
names, limits, retention, metrics, and prices immediately before issue #85's
owner-approved plan change.

If the first active-season week exceeds the expected model, move to the next
adequate tier before ingestion approaches 85%. A paid plan is capacity, not a
substitute for correcting abnormal noise.

## Recovery

If ingestion reaches 100%:

1. Treat the missing interval as an observability incident.
2. Record when the aggregate graph first flattened and when ingestion resumes.
3. Do not broaden a filter under incident pressure.
4. Preserve the current application release unless a tested logging regression
   is independently established.
5. If an approved filter caused diagnostic loss, disable that exact filter and
   verify aggregate ingestion resumes.
6. If retained useful volume legitimately exceeds capacity, follow issue #85's
   owner-approved plan-change procedure; never remove the add-on.

