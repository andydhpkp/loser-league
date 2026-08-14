# Change contract: Suppress empty Pick Reminder logs

## Problem and outcome

- Papertrail reached its free daily ingestion limit during Pick Reminders setup.
- The reminder coordinator currently logs an all-zero delivery summary every 30 seconds, and the calendar publisher logs successful refreshes even when publication did not change.
- Preserve actionable failures and real aggregate activity while removing those empty routine events.

## Scope

- Suppress `reminder_delivery_completed` only when every aggregate count is zero.
- Suppress `calendar_refresh_committed` unless at least one event was created, updated, or cancelled.
- Keep return values, scheduling, delivery, publication, warning/error logs, and all non-empty aggregate logs unchanged.
- Do not change Papertrail plans, filters, retention, reminder timing, eligibility, or provider behavior.

## Interfaces and safety

- No route, page, model, migration, external-provider, authentication, or authorization changes.
- Logs remain aggregate-only and must not add User, destination, Pick, credential, or production-data context.
- Rollback is a code revert; application state is unaffected.

## Verification

- Unit coverage proves an idle delivery pass emits no completion event and a non-empty pass still does.
- Calendar publication integration coverage proves an unchanged refresh emits no event while a material publication change still does.
- Run the complete repository PR gate before publication.

## Decisions

- Zero-value summaries are operational noise, not heartbeat evidence.
- Warnings, errors, cleanup summaries, campaign evaluation, and meaningful delivery/publication summaries remain unchanged.
