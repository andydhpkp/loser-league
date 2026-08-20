# Change contract: Recover Web Push devices automatically

## Problem and outcome

- Production accepted an email reminder while the same campaign's Push delivery
  ended `PERMANENTLY_FAILED`; the installed app displayed no notification.
- The transport currently collapses all definite 4xx responses into one outcome,
  hiding whether the endpoint expired or VAPID authorization was rejected.
- Restore actionable, privacy-safe diagnostics and automatically repair a device
  when the browser still has permission and an existing Push subscription proves
  prior opt-in.

## Scope

- In scope: provider-family/status/reason classification, invalidation only for
  404/410, retryable 401/403 authorization incidents, VAPID-key reconciliation,
  and automatic replacement of server-invalidated existing subscriptions.
- Out of scope: notification icon badges, new notification timing, provider-body
  logging, permission prompts without a direct User gesture, and VAPID rotation.
- Affected workflow: existing opted-in Push devices and Push reminder delivery.

## Behavior

- 2xx remains accepted; 404/410 means the device endpoint is gone and is
  invalidated; 408/429/5xx remains retryable; transport ambiguity remains
  unknown; 401/403 is a retryable authorization incident rather than proof that
  the device is invalid; other definite 4xx remains permanent.
- An Apple `403 BadJwtToken` receives one immediate, safe retry using the
  canonical HTTPS application origin as the VAPID subject. The first request
  was definitively rejected, so this cannot duplicate a delivered notification.
- Safe logs contain only provider family, integer status, allowlisted reason,
  and outcome. They never contain endpoints, headers, bodies, keys, tokens,
  subscriptions, Users, or reminder content.
- On settings-page load, an existing browser subscription is replaced without a
  permission prompt when its application-server key differs from current config
  or the server says that exact endpoint is no longer active.
- A device with no existing browser subscription is never auto-enrolled.

## Interfaces and data

- Existing Push routes and response bodies remain compatible.
- No schema or migration changes. Replacement uses existing delete/register
  behavior and encrypted subscription storage.
- Browser Push APIs and the external Push service are the only external systems.

## Design

- Provider classification remains inside `web-push-provider`; the transport
  emits sanitized diagnostics through an injected logger.
- Pure browser helpers compare application-server-key bytes and reconcile an
  existing subscription. The page module renders the returned status.
- Invalidating every 4xx was rejected because 401/403 identifies server
  authorization, not a dead endpoint. Auto-subscribing every permitted browser
  was rejected because permission is not equivalent to current opt-in.

## Safety and delivery

- Existing session authorization protects status and registration routes.
- No secret, endpoint, personal data, provider body, or notification payload is
  logged. Rollback is an ordinary application rollback with no data recovery.
- Existing invalid devices repair when the User next opens reminder settings;
  provider authorization incidents retry under the existing bounded policy.

## Verification

- Unit tests cover 401/403, 404/410, safe diagnostics, matching/mismatched VAPID
  keys, server-invalidated subscription replacement, and absence of automatic
  enrollment or permission prompts.
- Run unit tests, coverage, browser lint, disposable-database integration tests,
  and browser smoke tests before pull-request creation.

## Decisions and open questions

- Resolved: diagnostics are allowlisted; only 404/410 invalidates; 401/403
  retries; repair requires an existing browser subscription and granted
  permission; no schema change.
- Open questions: none.
- External dependency: browser and Push services must permit unsubscribe and
  resubscribe with the configured VAPID public key.

## Completion

- Update Pick Reminder operations and mobile-browser behavior documentation.
- Residual risk: an authorization rejection requires configuration diagnosis if
  bounded retries continue; automatic repair occurs when settings is opened.
- Next safe step: add failing transport and browser reconciliation tests.
