# Change contract: Badge an unread installed-app reminder

## Problem and outcome

- A Push reminder currently displays a notification but provides no persistent
  Home Screen icon indication.
- Set an app-icon attention badge when a reminder Push arrives and clear it when
  the User next opens or returns to the installed app.

## Scope

- In scope: declarative and service-worker badge setting, clearing on app open,
  foreground return, and notification activation, plus feature-detected fallbacks.
- Out of scope: durable unread counts, cross-device synchronization, badge
  preferences, schema changes, and treating a badge as delivery evidence.
- Affected workflow: installed Push-enabled web apps on supporting platforms.

## Behavior

- Every valid reminder Push still displays its existing user-visible notification
  and requests an app badge in the same background event.
- The badge represents one reminder requiring attention. It persists while the
  app remains unopened and clears when the dashboard/settings app starts,
  becomes visible again, or the notification is activated.
- Unsupported or user-disabled Badging APIs are silent no-ops. Badge failure
  never suppresses or delays the required notification.

## Interfaces and data

- The existing declarative Push payload adds `notification.app_badge: "1"`.
- No route, model, migration, permission prompt, or stored-data change.
- `WorkerNavigator` sets/clears in the service worker; window `Navigator` clears
  on open using feature detection.

## Design

- The Push event waits for both notification display and a best-effort badge.
- Shared PWA registration clears the badge immediately and on `visibilitychange`.
- Notification activation clears before focusing/opening the dashboard.
- A durable unread counter was rejected because the requested state is binary
  and no authoritative read model exists.

## Safety and delivery

- Existing notification permission controls platform badge visibility. No new
  permission is requested and no identity or reminder data is stored.
- Rollback removes the badge calls and payload member; no recovery is required.

## Verification

- Unit-test the declarative badge member, worker setting/clearing, notification
  preservation, feature detection, immediate clear, and visibility clear.
- Run all required unit, coverage, lint, integration, and smoke checks.

## Decisions and open questions

- Resolved: binary attention badge, clear on next open/return/notification click,
  no persistence, and feature-detected best effort.
- Open questions: none.
- External dependency: platform and User notification/badge settings.

## Completion

- Update mobile-browser and Pick Reminder operations documentation.
- Residual risk: platforms may render a numeric badge rather than a dot, or the
  User may disable badges independently of notifications.
- Next safe step: add failing payload, worker, and PWA-registration tests.
