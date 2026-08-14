# Change contract: Optional Pick reminders

## Problem and outcome

- Users can miss a Pick deadline unless they remember to open Loser League.
  The existing authenticated dashboard deliberately hides its dormant reminder
  seam, and the application does not currently send reminder email or push
  notifications or publish a calendar subscription.
- Add one optional **Pick Reminders** feature containing three independently
  selectable methods: installed-web-app push, verified email, and a shared
  Pick-deadline calendar subscription.
- Email and push remain off by default and require deliberate User consent.
  Calendar subscription requires an explicit action in the User's calendar
  application. Admin access controls never constitute reminder consent.
- Initial public release occurs only after all three methods are ready. The
  feature is developed through hidden sequential pull requests and exposed
  first to organizer-controlled beta Users.
- This contract implements GitHub issue #45 and intentionally replaces the
  dormant **Text Pick Reminder Settings** concept from issue #44 with the
  channel-neutral **Pick Reminder Settings** experience.

## Scope

- In scope:
  - one authenticated Pick Reminder Settings page and a matching dashboard
    action;
  - capability-aware PWA installation instructions and abbreviated Help copy;
  - an installable, network-required PWA shell with standards-based Web Push;
  - verified email reminders sent from a dedicated Gmail account;
  - one persistent shared calendar subscription containing trustworthy League
    Season Pick deadlines;
  - one fixed automatic reminder window 24 hours before the authoritative
    deadline;
  - pre-deadline automatic catch-up after downtime;
  - one additional admin-triggered reminder campaign per League Season round;
  - durable eligibility, campaign, outbox, retry, suppression, and duplicate
    prevention;
  - per-User beta access and an admin-controlled public release state;
  - global and per-provider operational safety controls;
  - sanitized operational visibility, retention, rollout, rollback, and owner
    setup documentation.
- Explicitly out of scope:
  - SMS, automated calls, marketing, payment/buyback messages, arbitrary admin
    broadcasts, or admin-composed notification text;
  - native iOS/Android applications or App Store/Play Store distribution;
  - arbitrary or User-configurable email/push timing in version one;
  - a one-time calendar event download;
  - changing a User's account email from reminder settings;
  - offline Picks, offline settings changes, or cached authenticated data;
  - delivery/read tracking pixels, personal click analytics, or claims that an
    email reached an inbox;
  - a special production test-send endpoint;
  - more than the registered **Pick Reminders** feature in the first admin
    feature-access release.
- Affected Users and workflows:
  - authenticated Users with an active entitlement (beta or public release);
  - active preseason, regular-season, and playoff rounds;
  - dashboard, Help, login return, admin User workspace, admin operations,
    weekly lifecycle coordination, schedule validation, and Heroku operations.

## Behavior

### Feature access and release

- One **Pick Reminders** feature covers push, email, and calendar together.
- Effective User access requires the Heroku/system emergency switch to permit
  the feature and either public release or per-User beta entitlement.
- The admin User workspace exposes **Pick Reminders Beta Access** only. Global
  admin operations expose **Release Pick Reminders to all Users**.
- Both access mutations use the established stale-safe preview/confirmation
  pattern and sanitized admin audit. Admins see entitlement state only; they
  never see reminder destinations, verification details, device identifiers,
  channel choices, or calendar usage.
- Entitlement never opts a User into a channel. Admins cannot grant consent,
  verify an email, grant browser permission, or alter User channel settings.
- With public release off, only entitled beta Users see or use settings. With
  public release on, all Users have access. Turning public release off returns
  access to beta Users only.
- Losing effective access hides settings and suppresses outbound delivery
  immediately. Reminder preferences and subscriptions are retained for 30
  days, restored if access returns, then deleted if access remains absent.
- The calendar feed is shared and public once available. Entitlement controls
  discovery in Loser League, not possession of a copied calendar URL.
- Initial public release requires email, push, and calendar to be configured
  and verified together. After launch, one unavailable provider degrades only
  that method; working methods remain available.

### Shared eligibility and timing

- Email and push are independently selectable and may both be enabled. A User
  may also subscribe to the calendar; enabling multiple methods may produce
  multiple alerts.
- Automatic email/push reminders use one fixed window: 24 hours before the
  current server-authoritative Pick deadline.
- A missed automatic attempt catches up after the 24-hour point until strictly
  before the deadline. It never runs at or after the deadline.
- Before every claim, delivery attempt, and retry, the server rechecks:
  - effective feature access;
  - the channel's operational availability and User opt-in;
  - active League Season, round, and authoritative deadline;
  - a round that is open and not Week 0/setup or complete;
  - at least one active Track with no committed Pick.
- Users with no active Tracks or only eliminated Tracks receive no personalized
  reminder. Their preferences persist for future eligibility.
- Pending Buyback Decisions do not suppress reminders. A User remains eligible
  when an active Track lacks a committed Pick, even if the dashboard requires
  the Buyback Decision before Pick submission.
- Active preseason, regular-season, and playoff rounds use the same rules.
- Browser state, clocks, local storage, request inputs, and calendar clients
  never decide eligibility or whether a reminder is due.
- Store one duplicate-safe automatic delivery record per User, League Season,
  round, channel, device where applicable, and 24-hour window.
- A schedule change updates the dashboard and calendar but does not create a
  second routine reminder after the round's automatic reminder was delivered.
  Correction broadcasts require a future approved contract.

### Notification content and navigation

- Email and push use minimal lock-screen-safe content equivalent to:

  > Loser League reminder  
  > You may still have Picks to complete. Open Loser League.

- Email subjects/preheaders and push payloads omit User names, Track counts or
  names, Teams, Picks, standings, buybacks, payments, and deadline time.
- Every reminder link targets the authenticated dashboard. Expired sessions
  use a safe login return destination and land on the dashboard afterward.
- A push click focuses an existing Loser League window when possible or opens
  the dashboard. It never mutates Picks or settings.
- Push click observability is aggregate and sanitized, with no cross-device
  tracking identifier.

### Email

- Reminder email uses only the existing required User account email. Reminder
  settings cannot change that address.
- Selecting **Enable email reminders** shows the masked address, obtains an
  informed confirmation, and sends a verification message.
- Verification tokens are cryptographically random, stored only as one-way
  hashes, single-use, expire after 24 hours, and are invalidated by a newer
  request or address change. Following a valid link verifies the address and
  enables email reminders in one flow.
- Verification requests allow at most one send per User per 10 minutes and five
  per User in 24 hours. Limits work across deploys and processes. Admins cannot
  bypass them or verify an address manually.
- Ordinary disable/re-enable preserves verification while the account email is
  unchanged. An address change, User deletion, documented security reset, or
  unverifiable stored integrity invalidates it and disables email until the
  current address is verified.
- Every reminder includes a cryptographically protected, password-free
  **Stop email reminders** link. It is idempotent, reveals no identity or
  League facts, disables email only, and links to authenticated settings for
  other methods. The authenticated settings page provides the same disable
  operation.
- The dedicated sender is `loserleague.reminders@gmail.com`; replies remain
  enabled and are monitored by an organizer.
- Gmail is behind a replaceable provider adapter. Version one uses a dedicated
  revocable Gmail app password, never the normal account password.
- Provider evidence is reported honestly as `accepted`, `unknown`, or
  `failed`; the application never claims `delivered` or `read`. No tracking
  pixel or personal click tracking is used. Organizers monitor the sender inbox
  for bounce messages.
- Definite temporary failures receive bounded retries before the deadline.
  Ambiguous responses become `unknown` and are not blindly resent. Gmail
  authentication rejection opens a channel circuit breaker and requires owner
  repair plus deliberate re-enablement.

### Installed web app and push

- The PWA uses the existing **Loser League** name and pumpkin football-player
  artwork, including required icon sizes and a maskable icon, and starts at the
  authenticated dashboard.
- Pick Reminder Settings contains capability-aware installation instructions:
  - iPhone/iPad: Safari, Share, Add to Home Screen, open the installed app,
    return to settings, then enable push;
  - Android: browser Install/Add to Home Screen, open the installed app, then
    enable push;
  - desktop: installation and push where supported;
  - expandable alternatives and clear unsupported/setup-required states.
- Browser/device hints choose instructions, but actual platform APIs determine
  support. Unsupported Users retain email and calendar options.
- Notification permission is requested only from the direct informed action
  **Enable push on this device**, never on load or through repeated prompting.
- A User may register multiple devices. Each browser/device is an independent
  encrypted push subscription. Settings show only a safe device count and
  controls for the current device and all devices.
- Web Push uses the standards-based Push API and VAPID through a replaceable
  server adapter. No paid push vendor or Firebase dependency is required.
- Store the full subscription payload encrypted with authenticated encryption
  under a dedicated rotatable key. Never return endpoints or encryption keys
  after registration or expose them in logs, audits, fixtures, or admin UI.
- Remove a subscription only after a definitive gone/not-found provider
  response. Losing the last valid device shows **Setup required**, not
  User-disabled. Temporary and ambiguous failures remain conservative.
- Push TTL expires at the authoritative deadline. A stable per-round topic may
  coalesce duplicate displays where supported.
- Cache only a minimal versioned static shell and artwork. Authenticated API
  responses, League data, Picks, and settings are never service-worker cached.
  Offline state is safe and read-only; all protected work requires a live
  authenticated connection.
- Service-worker updates download in the background and offer a safe reload.
  They never force-reload during Pick editing/submission and preserve compatible
  server contracts through the rollout window.

### Calendar subscription

- Publish one canonical public HTTPS `.ics` subscription feed shared across
  Users and League Seasons. Provide a `webcal:` subscribe action where useful,
  a copyable HTTPS link, and concise Apple Calendar, Google Calendar, and
  Outlook instructions.
- The application reports **Subscription link provided**, never **Enabled**;
  it cannot detect or remove subscriptions in external calendar applications.
- Calendar reminders are general deadline reminders. They may still alert a
  User after Picks are complete. The settings page explains this limitation.
- Each event contains only **Loser League Picks Due**, the authoritative
  deadline, the canonical dashboard URL, and a suggested 24-hour alarm. The
  calendar application may replace or ignore the suggested alarm and controls
  its own notification timing.
- Publish every trustworthy known deadline for the active League Season in
  advance, spanning preseason, regular season, and playoffs. Omit rather than
  invent an unvalidated deadline.
- Stable UIDs and sequence numbers update schedule changes without duplicates.
  Cancel or invalidate a formerly published upcoming event with a standards-
  compliant cancellation/update.
- The same subscription persists between seasons. It may contain no upcoming
  events before trustworthy schedules exist, then fills automatically.
- Keep events in the feed until 30 days after their deadline, plus cancellation
  state required for previously published upcoming events.
- Generate from validated server schedule state, support `ETag` and
  `Last-Modified`, and permit at most five minutes of public caching. During a
  temporary upstream outage, serve the last trustworthy feed rather than
  fabricated or partially validated data.
- Calendar publication has its own safety control and remains independent of
  email/push incidents. Disabling it returns a valid safe empty/cancellation
  state rather than a generic server failure.

### Admin-triggered campaign

- Admins may create one additional manual campaign per League Season round at
  any time while Pick submission is open. It does not consume, replace,
  suppress, or reschedule the automatic 24-hour reminder.
- A manual campaign uses every enabled email and push method for each eligible
  User; there is no admin channel selector. Calendar clients are not pushed.
- The admin cannot compose content, select recipients, bypass opt-in or
  verification, send after the deadline, or send to an ineligible User.
- Preview shows only League Season, round, authoritative deadline, aggregate
  eligible delivery counts, and sanitized warnings. It expires after 10
  minutes. Confirmation rechecks all context and fails stale if it materially
  changed.
- Warn without blocking when the automatic reminder is due within two hours or
  was sent within the previous two hours.
- Campaign uniqueness makes repeated clicks, deploys, restarts, and concurrent
  admins idempotent. Campaign, delivery outbox, and sanitized admin audit are
  created atomically; provider calls occur only after commit.
- Admin operational views expose aggregate evaluated, claimed, accepted,
  unknown, failed, suppressed, invalid-subscription, calendar freshness, and
  provider-unavailable counts. They expose no destinations or message bodies.

### Failure and retry rules

- Use bounded backoff only for definite temporary failures.
- Recheck eligibility and consent before every attempt and retry. Stop when
  Picks complete, access/consent is withdrawn, the round or season changes, or
  the deadline arrives.
- An ambiguous provider result is `unknown`, never permission to resend.
- Schedule changes, multiple web processes, timers, recovery loops, deploys,
  restarts, and request wake-ups cannot produce late or duplicate reminders.
- Provider failure never reopens Picks or changes League state.
- Safe User states include off, setup/verification required, enabled,
  User-disabled, provider-blocked/suppressed, and temporarily unavailable.

## Interfaces and data

### PR 1 fixed contracts

- `PICK_REMINDERS` is the only registered feature key. Durable state lives in
  `feature_release`, `user_feature_entitlement`, and
  `user_feature_access_state`; the last table records the start and expiry of
  the confirmed 30-day grace period without storing channel or consent data.
- `PICK_REMINDERS_SYSTEM_AVAILABLE` is the validated master availability
  setting. Only the normalized values `true` and `false` are accepted; missing
  or invalid values resolve to false and invalid configuration is logged by
  setting name only.
- `GET /api/admin/features` returns only
  `{ features: { pickReminders: { publicReleased, stateVersion } } }`.
- `GET /api/admin/users/:userId/workspace` adds only
  `features.pickRemindersBetaAccess` with `enabled` and `stateVersion`.
- Existing preview/confirm routes register
  `SET_PICK_REMINDERS_BETA_ACCESS` with `{ userId, enabled }` and
  `SET_PICK_REMINDERS_PUBLIC_RELEASE` with `{ enabled }`. Preview and audit
  states contain only feature key, enabled/released state, version, numeric
  User ID where applicable, and grace timestamps; no consent or destination
  data exists in PR 1.
- `GET /api/user/dashboard` replaces `features.textPickReminders` with
  `features.pickReminders`, a server-authored boolean effective-access value.
  The browser renders the label **Pick Reminder Settings** only when true; PR 1
  provides no settings route, so the action is disabled and identifies the
  feature as not yet available.

### PR 2 fixed contracts

- `reminder_preference` stores one provider-neutral row per User with independent
  `email_enabled` and `push_enabled` booleans. Both default false, survive
  League Season rollover, cascade on User deletion, and contain no destination
  or provider data.
- `reminder_campaign` identifies one `AUTOMATIC` or `MANUAL` campaign by League
  Season, schedule phase, and round. The automatic identity uses the stable
  `FIXED_24_HOUR_V1` window key; its identity never includes a deadline. A
  unique constraint permits only one automatic window and one manual campaign
  for that round across processes and schedule changes.
- `reminder_delivery` is the provider-neutral outbox. It is unique by campaign,
  User, and channel and stores only bounded attempt/claim/result metadata,
  including durable claim and temporary-failure counters. It
  stores no destination, message body, Pick, Team, username, email, endpoint,
  credential, provider payload, or request body.
- Provider adapters implement `send(intent)` where intent is exactly
  `{ kind: "PICK_REMINDER", channel, navigateTo: "DASHBOARD" }`, and return one
  of `ACCEPTED`, `TEMPORARY_FAILURE`, `PERMANENT_FAILURE`, or `UNKNOWN`.
  `UNKNOWN` is terminal and is never blindly resent.
- A claim lease is two minutes. Definite temporary failures retry after one,
  five, and fifteen minutes, for at most four total attempts. Timing and clocks
  are injectable in tests. Eligibility is rechecked before campaign creation,
  every claim, every provider attempt, and every retry.
- Retention cleanup deletes at most 100 delivery/campaign rows per transaction
  and retains the active and immediately previous League Seasons. Preferences
  are removed only by User deletion or expiry of PR 1's 30-day access-removal
  grace state.
- `SEND_PICK_REMINDERS` is the registered actorless admin action. It accepts no
  intent fields. Preview and confirmation use the existing ten-minute,
  one-use, stale-safe routes and return only League Season, phase/round,
  authoritative deadline, aggregate channel counts, and sanitized warnings.
  Campaign, outbox, and audit commit atomically; providers are invoked only
  after commit.
- Operational settings are `PICK_REMINDERS_EMAIL_DELIVERY_AVAILABLE`,
  `PICK_REMINDERS_PUSH_DELIVERY_AVAILABLE`, and
  `PICK_REMINDERS_ADMIN_CAMPAIGN_AVAILABLE`. Like the PR 1 master setting, only
  lowercase `true` and `false` are valid and every absent or invalid value
  fails closed. Repository and production documentation leave them absent/off.

### Routes and browser interactions

- Replace the dormant dashboard capability with a server-authored effective
  **Pick Reminders** access state and render **Pick Reminder Settings** only
  when effective access exists.
- Add a protected settings page and authenticated JSON seams for:
  - safe settings/status read;
  - request email verification;
  - disable/re-enable verified email;
  - register/disable current-device push;
  - disable all push devices;
  - obtain VAPID public key and safe capability metadata;
  - obtain calendar subscription instructions/link.
- Add public, token-protected email verification and opt-out landing routes
  with no identity disclosure.
- Add the public calendar route with calendar MIME type, conditional requests,
  and safe caching.
- Extend existing protected admin User-workspace and admin-action seams for
  entitlement/public-release preview and confirmation.
- Add admin campaign preview/confirmation and aggregate operational status.
- Exact route names, methods, stable success/error responses, CSRF posture, and
  token transport are fixed in the first implementation PR before behavioral
  code. Browser pages do not reach through DOM owned by data modules.

### Models and migrations

- Use reviewed forward-only additive migrations. The conceptual durable data
  includes:
  - registered User feature entitlement for `PICK_REMINDERS`;
  - global public-release state with concurrency/version evidence;
  - per-User channel preferences and verified-email evidence;
  - hashed email verification and opt-out token records with expiry/use state;
  - encrypted per-device push subscriptions and safe operational metadata;
  - per-round automatic reminder windows;
  - unique manual campaign records;
  - durable delivery/outbox records with claim, attempt, result, suppression,
    and unknown-delivery state;
  - trustworthy calendar publication snapshots/version evidence where needed;
  - sanitized admin-audit links using existing admin audit conventions.
- Final table/column names and constraints are selected during the foundation
  PR after inspecting migration conventions and MySQL index limits. Unique keys
  must encode the automatic/manual duplicate-prevention contracts.
- Multi-write state transitions and claims use transactions and row locks or
  equivalent version checks. Tests use only disposable MySQL schemas whose
  `TEST_DATABASE_URL` contains `test`.

### Module boundaries and dependency flow

- A server configuration module validates operational controls and required
  secrets at startup; absence or invalidity fails closed for that capability.
- An entitlement/release module owns effective feature access and grace-period
  retention. Dashboard and settings consume its small interface.
- A reminder eligibility/policy module owns deterministic due/eligible rules
  without Express, provider calls, or browser code.
- A reminder application service owns campaign creation, transactional outbox
  claims, rechecks, retries, and sanitized outcomes.
- Email and push providers are adapters behind narrow interfaces. The domain
  does not import Gmail/SMTP or Web Push libraries.
- Calendar generation consumes validated schedule facts through a narrow
  application seam and owns RFC-compliant serialization separately from NFL
  transport clients.
- Exact timer, startup catch-up, and periodic recovery reuse the existing
  server-owned lifecycle coordinator pattern and call one reminder operation.
  Correctness does not depend on any trigger or browser request.
- Page entry modules own DOM binding; focused browser modules own installation,
  push subscription, settings data, and display transformations.

### External systems and dependencies

- Gmail: dedicated account, app-specific credential, TLS-authenticated send,
  limited delivery evidence, and manual bounce monitoring.
- Browser push services: standards-based subscriptions and VAPID. Recheck the
  selected maintained Node Web Push dependency, license, vulnerabilities,
  Node compatibility, and removal cost immediately before adding it.
- Calendar clients: Apple, Google, Outlook, and other RFC-compatible clients
  fetch a public feed on provider-controlled schedules.
- Existing NFL schedule providers remain the authoritative schedule input;
  calendar publication must not create a competing deadline algorithm.
- Heroku: existing always-running web process and database only; no new worker
  dyno or external scheduler is required.

### Compatibility

- Existing authenticated dashboard, Pick, League, Help, admin, and direct-link
  behavior remains compatible while the feature is hidden.
- Intermediate deployments keep public release off and ordinary Users see no
  reminder action, Help copy, calendar link, or usable reminder API.
- The final dashboard label intentionally replaces the old issue #44 text-only
  seam. Update its plan/behavior tests and issue language rather than retaining
  a misleading compatibility alias.
- Different application versions may coexist during deployment; additive
  schema and stable response changes must tolerate that window.

## Safety and delivery

### Authentication, authorization, and consent

- Server session is the only authority for settings and per-User access.
- Shared-admin authentication authorizes entitlement, release, campaign, and
  aggregate operational actions but never User consent.
- Public email actions use scoped, cryptographically random, hashed, expiring,
  idempotent tokens. They never reveal whether an unrelated User/address exists.
- Browser push permission follows an informed direct User gesture.
- Calendar subscription remains an explicit external-client action.

### Secrets and personal data

- Never store or expose Gmail normal password, app password, VAPID private key,
  application encryption key, raw verification/opt-out tokens, push endpoints,
  push encryption keys, session values, provider payloads, or request bodies in
  source, browser storage, responses beyond the exact required setup seam,
  logs, audits, fixtures, screenshots, or documentation.
- Use a dedicated application encryption key for push subscriptions. Do not
  reuse session, VAPID, email, or database credentials. Document versioned key
  rotation that can decrypt old records long enough to re-encrypt or expire
  them.
- Admin and operational data is aggregate and sanitized. Reminder content
  contains no personal or sensitive League data.
- Consent is scoped only to Pick reminders and cannot be reused for marketing,
  payments, or unrelated messages.

### Retention and deletion

- Keep verified-email preference while the User exists and the email remains
  unchanged, unless reset for documented security reasons.
- Keep push subscriptions until User disablement, confirmed invalidity,
  deletion, or expiry after lost access.
- Delete expired verification requests promptly.
- Retain sanitized delivery history for the active and immediately previous
  League Seasons, then delete it. Store no message body in history.
- Delete reminder preferences, verification evidence, and push subscriptions
  when a User is deleted.
- Apply the confirmed 30-day grace period after beta/public access removal.

### Operational controls

- Heroku/system controls remain emergency and provider-readiness controls, not
  User-facing feature flags. At minimum validate controls equivalent to:
  - master reminder system availability;
  - email delivery availability;
  - push delivery availability;
  - calendar publication availability;
  - admin manual-campaign availability.
- All controls default off in a new or invalidly configured environment.
- Admin database state controls per-User beta access and public release.
- Turning a delivery control off stops new attempts without erasing consent.
  Settings show temporary unavailability, not User-disabled.
- Calendar remains independent from email/push and can serve the last
  trustworthy feed during temporary upstream outages.

### Owner setup required before production enablement

The repository implementation must document exact commands and validation, but
the owner performs these steps later. No real values belong in this plan.

- [ ] Confirm and configure the exact canonical HTTPS Heroku origin through a
      validated setting such as `PUBLIC_APP_ORIGIN`.
- [ ] Enable two-step verification on
      `loserleague.reminders@gmail.com`.
- [ ] Generate a dedicated Gmail app password and store it only in protected
      Heroku configuration; never provide it in chat, source, or tickets.
- [ ] Configure the Gmail sender identity and monitored reply mailbox.
- [ ] Generate one long-lived VAPID keypair; expose only the public key through
      the required browser seam and keep the private key in Heroku config.
- [ ] Generate a separate high-entropy reminder-data encryption key and record
      the documented rotation/recovery procedure.
- [ ] Configure master, email, push, calendar, and admin-campaign operational
      switches with safe false defaults.
- [ ] Keep public release off and grant beta access only to organizer test Users.
- [ ] Verify real email, push, and calendar behavior on the confirmed test
      matrix without contacting ordinary Users.
- [ ] Confirm monitoring, Gmail inbox/bounce review, credential-revocation,
      incident response, and rollback ownership.
- [ ] Enable public release through the audited admin control only after the
      complete production checklist passes.

### Rollout and rollback

- Use additive forward-only migrations. Do not drop reminder tables during an
  operational rollback.
- Hidden multi-PR program:
  1. feature entitlement and audited beta/public-release controls;
  2. shared preference, eligibility, automatic/manual campaign, durable outbox,
     coordinator, retry, and retention foundation;
  3. PWA shell, installation guidance, encrypted multi-device subscription,
     and Web Push adapter;
  4. Gmail verification, opt-out, and email delivery adapter;
  5. shared persistent calendar subscription and client instructions;
  6. integrated settings/Help experience, cross-channel verification,
     operations documentation, and launch readiness.
- Every intermediate PR keeps ordinary-User access off. A PR is not created
  unless every check required by `docs/engineering/README.md` passes, including
  integration and browser smoke requirements.
- Production testing starts with organizer-controlled beta Users across one
  installed iPhone/Safari PWA, Android/Chrome PWA, supported desktop browser,
  separate Gmail recipient, and at least Apple or Google Calendar.
- Public release is a single audited admin state change after all three methods
  pass production readiness checks.
- Roll back globally through the master operational switch, or isolate a
  broken provider with its channel control. Turning public release off returns
  access to beta Users and applies the 30-day grace period to others.

### Observability and incident response

- Log sanitized operation/campaign summaries and actionable provider/system
  failures once at the owning layer. Exclude identities, destinations, tokens,
  subscriptions, payloads, Picks, and request bodies.
- Monitor evaluator freshness, due/claimed/accepted/unknown/failed/suppressed
  counts, retry exhaustion, expired/invalid subscription counts, circuit-breaker
  state, calendar snapshot age, and cleanup progress.
- Gmail authentication rejection and invalid encryption/key configuration fail
  closed. Document credential revocation, VAPID/encryption-key rotation,
  subscription loss, calendar correction, data deletion, and compromised-link
  response.

## Verification

### Pure and unit tests

- Controlled clocks around 24 hours before, immediately before, exactly at,
  and after the deadline; startup/downtime catch-up; schedule moves; Week 0;
  season completion; preseason, regular season, and playoffs.
- Eligibility for zero/many active Tracks, all submitted, some missing, all
  eliminated, pending Buyback Decision, consent/access withdrawal, and round
  change.
- Automatic/manual uniqueness, proximity warning, one manual campaign per
  round, and schedule change after a sent reminder.
- Minimal content assertions and absence of identity, Track, Team, Pick,
  standings, payment, buyback, and deadline-time data.
- Verification/opt-out token hashing, expiry, supersession, idempotency,
  address-change invalidation, and durable rate limits.
- Push encryption/decryption and key-version rotation, multiple devices,
  definitive invalidation, ambiguous result, TTL, topic, and safe status.
- Calendar RFC serialization, stable UID/sequence, updates, cancellation,
  alarms, all known rounds, preseason/playoffs, cross-season continuity,
  30-day history, conditional caching, and last-trustworthy fallback.
- Operational-control parsing fails closed and effective entitlement/release
  rules honor the 30-day grace period.
- Browser modules cover capability detection, permission gesture, denied/
  unsupported/setup-required states, safe service-worker update, and offline
  shell behavior without authenticated caching.

### HTTP and authorization tests

- Protected page/API access, beta/public entitlement, master/provider controls,
  session expiry, and safe post-login dashboard return.
- Admin entitlement/release/campaign preview, expiry, stale confirmation,
  concurrency, authorization, audit, and aggregate-only response contracts.
- Verification and opt-out success, invalid/expired/reused token, enumeration
  resistance, safe response content, and rate limiting.
- Push subscribe/unsubscribe validation, ownership, multiple devices, payload
  size limits, invalid endpoints/keys, and no secret reflection.
- Calendar content type, public access, caching headers, invalid schedule,
  cancellation, operational disablement, and no User-specific content.
- Browser/request inputs cannot select season, round, deadline, recipients,
  Picks, message text, or duplicate identifiers.

### Disposable-MySQL integration tests

- Additive migrations, foreign keys, unique constraints, cleanup/retention, and
  deletion cascades or explicit deletion behavior.
- Concurrent evaluator instances, startup plus timer/recovery races, manual
  campaign confirmation races, transaction rollback at every multi-write
  boundary, and durable no-duplicate behavior after restart.
- Consent/access/Pick completion/deadline races against claim and retry.
- Ambiguous versus definite provider responses, circuit-breaker state, expired
  verification requests, and multi-process rate limits.
- Use fake email/push providers, controlled schedules/clocks, deterministic
  tokens where safely injected, and a disposable database whose name contains
  `test`; never contact real Users or providers.

### Browser smoke and accessibility tests

- Exact dashboard label and action position, hidden versus beta/public release,
  integrated three-method settings, and Help guidance.
- iPhone/Android/desktop instruction variants, installation states, permission
  gesture/denial, multi-device controls, service-worker update prompt, offline
  shell, and dashboard navigation from a notification simulation.
- Email verification and opt-out landing states, calendar subscribe/copy UX,
  honest **Subscription link provided** wording, and provider-limit warnings.
- Loading, partial failure, retry, expired session, channel outage, global
  rollback, 30-day access grace presentation, and no stale success claims.
- Keyboard/focus order, semantic controls/status, live-region restraint,
  visible focus, screen-reader names, reduced motion, narrow screens, landscape,
  large text, touch targets, wrapping, and no color-only status.
- Smoke tests use fake providers and controlled browser seams, never live Gmail,
  push endpoints, production schedules, or shared data.

### Required commands and live checks

- During each PR, run the fastest relevant unit and browser lint checks.
- Before any PR, run every command required by
  `docs/engineering/README.md`, including unit coverage, browser lint,
  disposable-MySQL integration tests, and browser smoke tests. A skipped,
  blocked, unavailable, or known-failing required check blocks PR creation.
- Live provider checks occur only after code verification, migration success,
  owner configuration, and organizer-only beta entitlement. Record sanitized
  outcomes without credentials, destinations, tokens, or provider payloads.

## Decisions and open questions

### Resolved decisions

- Push, email, and calendar launch together under one feature and may be used
  in any combination.
- Email/push use one fixed 24-hour automatic window; later bounded timing
  customization requires a follow-up contract. Calendar-client alert timing is
  controlled by the calendar application.
- Calendar is one public, persistent, cross-season subscription and can alert
  after Picks are complete.
- Notifications are minimal and link to the dashboard without deadline time.
- Push is standards-based, vendor-free VAPID Web Push and supports multiple
  devices.
- Email uses the existing account email, one-time verification, a monitored
  dedicated Gmail sender, revocable app password, and password-free opt-out.
- The existing Heroku web process and durable database coordinate delivery; no
  additional worker or scheduler is required.
- Admins may trigger one extra all-enabled-channel campaign per round without
  affecting the automatic reminder, subject to all normal consent/eligibility
  rules.
- Per-User beta entitlement and audited admin public release coexist with
  Heroku emergency/provider controls.
- Buyback blocking does not suppress reminders.
- Owner Heroku configuration is explicitly deferred until implementation is
  verified and ready for controlled production testing.

### Open implementation details

- Exact route names, response schemas, table names, indexes, claim lease/backoff
  values, calendar library choice, SMTP transport dependency, Web Push package,
  PWA icon asset derivation, and operational setting names are selected in the
  relevant PR while preserving this behavior contract.
- Confirm Gmail's then-current app-password, SMTP, and sending-limit rules and
  Apple/Google/browser Web Push requirements immediately before production
  enablement.
- Confirm the upstream schedule interface can safely enumerate future rounds;
  add a dedicated validated season-schedule seam rather than broadening an
  active-week rule implicitly.
- Decide whether the entitlement/public-release mechanism warrants a permanent
  ADR after its first implementation reveals the final durable shape.

## Completion

- Update authenticated navigation/dashboard behavior, route contracts,
  architecture/module boundaries, lifecycle coordination, mobile/browser test
  inventory, security/privacy guidance, admin access, Heroku deployment and
  reminder operations, Help content, and issue #45 as each PR lands.
- Record the **Pick Reminders** feature term and User-facing channel language in
  `CONTEXT.md` if implementation introduces durable domain vocabulary.
- Residual risks:
  - calendar providers refresh on schedules Loser League cannot control and may
    replace or ignore the suggested alarm;
  - Gmail acceptance does not prove inbox delivery and Gmail offers limited
    automated bounce evidence at this scale;
  - browser/Web Push support and permission recovery vary by device;
  - a delivered notification cannot be retracted after a later NFL schedule
    change;
  - a copied public calendar URL cannot be revoked per User;
  - the existing shared-admin authority is not attributable to an individual,
    so audits remain actorless under the current contract.
- Next safe step: split this contract into the six hidden implementation PRs,
  define the first PR's exact entitlement/release seams and failing tests, and
  keep all production controls and public release off.

## PR 3 fixed contracts: PWA and push

- Public shell: `/manifest.webmanifest`, `/service-worker.js`, `/offline.html`, and local 192/512/maskable icons. The worker version-caches only the offline page, shared CSS, and icons. Navigation is network-first; APIs and authenticated responses are never intercepted. Updates wait for safe User reload/navigation and only emit an update-available browser event.
- Hidden authenticated routes are `GET /api/user/reminders/push/configuration`, `POST /status`, `PUT /subscription`, `DELETE /subscription`, and `DELETE /subscriptions`. Request shapes and safe responses are fixed in the route contract. They require the User session and effective access; registration also requires push operational readiness.
- `push_subscription` stores a purpose-bound HMAC-SHA-256 endpoint digest, AES-256-GCM ciphertext/nonce/tag/key version, owner, and minimal state. `push_device_delivery` uniquely keys the parent User/channel delivery and device, with durable claim/result state. No plaintext subscription, payload, user agent, IP, hardware, or fingerprint data is stored.
- First/additional registration enables the provider-neutral push preference. Current-device disable removes only that device and leaves consent enabled; loss of the final device reports `SETUP_REQUIRED`. Explicit disable-all removes every device and sets the push preference false (`USER_DISABLED`). Confirmed-gone devices invalidate independently. User deletion cascades, season rollover preserves devices, and expired 30-day access grace deletes them transactionally.
- Encryption configuration is a base64 32-byte current key plus a 1–32 character version. An optional prior pair decrypts during bounded rotation; writes always use current. Endpoint identity uses a separate base64 32-byte digest key. Missing, partial, malformed, or duplicate-version configuration fails closed.
- `web-push` 3.6.7 is isolated behind a replaceable transport. Provider classification is 2xx accepted, 404/410 gone, 408/429/5xx temporary, other definite 4xx permanent, and transport ambiguity unknown. Per-device accepted/unknown terminal state prevents blind resend. Aggregate priority is unknown, temporary, accepted, permanent.
- Payload is exactly the approved title/body and navigates only to the canonical dashboard derived from `PUBLIC_APP_ORIGIN`. TTL is remaining whole seconds before the authoritative deadline; at/after deadline fails closed. Topic is bounded as `ll-<season>-<round>`.

## PR 4 fixed contracts: verified email

- Hidden authenticated routes are `GET /api/user/reminders/email`, `POST /api/user/reminders/email/verification-requests`, `POST /api/user/reminders/email/enable`, and `POST /api/user/reminders/email/disable`. Mutation bodies must be exactly `{}`. They use only the session User, require effective Pick Reminders access, set `Cache-Control: private, no-store`, and never accept or return a User ID or full destination. Status returns only `maskedDestination` and one of `OFF`, `VERIFICATION_REQUIRED`, `VERIFICATION_PENDING`, `ENABLED`, `USER_DISABLED`, or `TEMPORARILY_UNAVAILABLE`.
- Public landing routes are `GET /reminders/email/verify?token=...` and `GET /reminders/email/stop?token=...`. Both return neutral, non-personalized HTML with `Cache-Control: no-store`; invalid, expired, superseded, consumed, tampered, and replayed verification links share a safe failure presentation. Opt-out always presents **Email reminders are off.** Error logging records the matched route template, never the original URL or query string.
- `email_reminder_verification` stores one row per User containing only a purpose-bound HMAC-SHA-256 digest of the normalized current account email, verification time, security-reset version, and state version. `email_verification_request` stores a random-token HMAC, the same email evidence, key version, expiry, sent/consumed/superseded timestamps, and minimal result state. `email_opt_out_token` stores only a scoped random-token HMAC, key version, security-reset version, expiry, and use time. All rows cascade on User deletion and store no plaintext destination or raw token.
- Email normalization trims the address, normalizes the domain to lowercase ASCII, and preserves the local part. Evidence and token hashes use a dedicated versioned 32-byte email token key with explicit purpose prefixes; current and one prior key may coexist for bounded rotation. Verification expires after 24 hours. A newer request supersedes every unused request for that User. Verification plus preference enable commits atomically under row locks. Ordinary disable preserves verification; unchanged verified re-enable is immediate. Any digest mismatch disables email and requires verification.
- Verification requests lock the User and verification history. One accepted request is allowed per ten minutes and five per rolling 24 hours, including boundary-safe concurrent requests. A limited response is HTTP 429 with a persisted `Retry-After` value and `{ state: "RATE_LIMITED", retryAfterSeconds }`; it reveals no counters. Cleanup deletes at most 100 expired/superseded request and expired opt-out rows per transaction and reports counts only.
- Each reminder attempt creates a distinct random opt-out token before provider handoff. Tokens expire after 400 days, remain idempotent after first use, disable email only, and are accepted under the current or configured prior key. Security reset increments the verification security version and invalidates outstanding opt-out tokens. User deletion and expired access grace delete all email setup rows.
- Verification messages are plain text only, use the canonical `PUBLIC_APP_ORIGIN`, expire after 24 hours, and never create a reminder campaign. Reminder messages contain only the fixed subject/body, canonical dashboard link, opt-out link, and monitored-reply wording. Neither message contains names, destinations, League/Track/Pick facts, deadlines, tracking content, or provider metadata.
- Gmail transport is isolated behind the existing provider interface and Nodemailer. It uses `smtp.gmail.com:465` with authenticated TLS, the dedicated sender/login `loserleague.reminders@gmail.com`, and an app password. SMTP 2xx acceptance maps to `ACCEPTED`; definite 4xx recipient/server responses to `TEMPORARY_FAILURE`; definite non-auth 5xx recipient rejection to `PERMANENT_FAILURE`; timeouts, connection resets, protocol ambiguity, and uncertain transmission to terminal `UNKNOWN`. `EAUTH`, missing auth, or SMTP 535 opens the breaker instead of becoming a recipient result.
- `email_provider_health` is a singleton durable Gmail breaker. The first authentication rejection atomically opens it for the configured credential version and emits one sanitized alert across processes. Open state suppresses new email claims/retries and makes status temporarily unavailable without changing consent or verification. Recovery requires owner credential repair plus a deliberate change to `PICK_REMINDERS_GMAIL_CREDENTIAL_VERSION`; a process restart or later successful connection does not close it. No application route edits credentials or resets the breaker.
- Configuration is `PICK_REMINDERS_EMAIL_FROM`, `PICK_REMINDERS_EMAIL_REPLY_TO`, `PICK_REMINDERS_GMAIL_USER`, `PICK_REMINDERS_GMAIL_APP_PASSWORD`, `PICK_REMINDERS_GMAIL_CREDENTIAL_VERSION`, `PICK_REMINDERS_EMAIL_TOKEN_KEY`, `PICK_REMINDERS_EMAIL_TOKEN_KEY_VERSION`, and optional prior key/version, plus existing `PUBLIC_APP_ORIGIN`. Addresses must equal the approved Gmail sender. Keys are canonical base64 32-byte values and versions are bounded. Missing, partial, or malformed settings fail closed and warnings name settings only.
- PR 2 remains authoritative for eligibility, campaigns, claims, retries, suppression, and retention. Email adds verified-address and breaker readiness to both claim-time and attempt-time rechecks, resolves `User.email` only immediately before setup/provider send, and never stores destination or content in `reminder_delivery`. All automated tests inject fake transports and never contact Gmail or real recipients.
- Nodemailer is upgraded only to the current maintained 9.x line because the installed 6.7.3 predates current SMTP/STARTTLS hardening. Node 22 is compatible. SMTP keeps the adapter replaceable and has no transitive runtime dependencies; removal requires replacing only the transport factory and its classification tests.
- Schema changes are additive and forward-only. Operational rollback keeps master/email controls off and preserves tables for a forward correction. Production controls, public release, Gmail credentials, token keys, and owner setup remain off/deferred in PR 4. Calendar and the combined settings/Help UI remain out of scope.
