# Pick Reminders foundation operations

## Final owner-run launch checklist (PR 6)

PR 6 completes the fail-closed application experience; it does not authorize production configuration, beta enrollment, provider traffic, or public release. Keep every operational control absent or `false` and public release off until an owner completes this checklist.

Configure real values only through authorized Heroku Config Var management, never source, tickets, chat, logs, screenshots, retained shell history, or deployment transcripts. Do not retrieve or print values after entry. Owner-supplied settings are `PUBLIC_APP_ORIGIN`; `PICK_REMINDERS_SYSTEM_AVAILABLE`; the push, email, admin-campaign, and calendar availability controls; the VAPID public/private key and subject; current reminder-data encryption key/version and optional prior pair; push-subscription digest key; approved Gmail sender/login/reply-to, app password, and credential version; and current email token key/version plus optional prior pair. Use the exact names validated by the configuration modules.

Enable two-step verification for the dedicated `loserleague.reminders@gmail.com` account and create a dedicated revocable app password—never use the normal password. An organizer must monitor the mailbox for replies, bounces, authentication warnings, and limits. Generate every VAPID/encryption/digest/token key independently with maintained cryptographic tooling in a non-retained session.

Deploy the tested commit with controls off so forward migrations run first. Validate only safe setting-name/readiness categories. Configure the intended organizer-beta channels, grant beta access to one organizer-controlled User through admin preview/confirmation, and verify an ordinary User remains excluded. Keep public release off.

The controlled beta must cover iPhone/iPad Safari Add to Home Screen, PWA launch, push permission and click navigation; Android Chrome install/push/click; supported desktop install, push, current-device/all-device disable; email verification, reminder, monitored reply, password-free opt-out, and re-enable; Apple or Google plus Outlook calendar subscription, stable update/cancellation, alert limitation, and removal; multiple devices/channels; one manual campaign and proximity warning; provider outages; global/public rollback; and continued ordinary-User exclusion. Use only a safe organizer-controlled recipient and never unexpected shared or production data.

Monitor coordinator freshness, automatic windows, manual campaign state, aggregate accepted/unknown/failure/suppression/retry totals, Gmail breaker, invalid push subscriptions, calendar snapshot age and validators, verification rate limiting, cleanup, access-grace expiry, readiness, and release state. Accepted means provider acceptance only, not inbox delivery or reading.

Recovery is channel-first and fail-closed: turn off email for Gmail authentication/limit incidents, rotate the app password and credential version deliberately, and never resend unknown outcomes blindly; turn off push for VAPID or broad encryption failures, preserving subscriptions on temporary failures; rotate encryption/token keys using the documented current/prior version window; turn calendar off to publish the safe state while authoritative schedule/publication is repaired; and use the master switch for an integrated incident. Secret exposure requires immediate provider disable, revocation, rotation, sanitized evidence preservation, and impact assessment. Duplicate/late suspicion requires disabling the affected channel, preserving aggregate evidence, and checking authoritative deadlines and concurrency—not a compensating broadcast.

Turning public release off immediately stops non-beta discovery/delivery and starts their 30-day grace period; beta Users remain active. Restoring access during grace restores setup. Copied calendar subscriptions cannot be revoked per User. Prefer a forward application fix because migrations are additive.

Before public release, require all automated checks, local secret scan, visual inspection, and GitGuardian to pass or be formally resolved; all three channels, canonical origin, adapters, breaker, trustworthy calendar state, migrations, and protected route to report ready together; the complete controlled beta to pass; and explicit owner preview/confirmation. Readiness never enables release automatically. Issue #45 remains open until external setup, beta, and release evidence are complete.

## Hidden verified-email configuration (PR 4)

Email remains off and hidden until the complete program is approved. Owner setup later must configure the approved `loserleague.reminders@gmail.com` address identically in `PICK_REMINDERS_EMAIL_FROM`, `PICK_REMINDERS_EMAIL_REPLY_TO`, and `PICK_REMINDERS_GMAIL_USER`; a dedicated Gmail app password in `PICK_REMINDERS_GMAIL_APP_PASSWORD`; and a deliberately managed `PICK_REMINDERS_GMAIL_CREDENTIAL_VERSION`. The account must have 2-Step Verification enabled. Generate the app password in Google Account security and store it only in protected Heroku configuration. Never use the normal Gmail password or paste either credential into source, tests, logs, tickets, screenshots, chat, or deployment transcripts.

SMTP uses authenticated TLS to `smtp.gmail.com:465`. The sender inbox and replies must be monitored by an organizer. Gmail acceptance means only that Gmail accepted the SMTP transaction; it does not prove inbox delivery or reading. Consumer Gmail currently documents a 500-message/day limit, and sending may pause for 1–24 hours after a limit. Verification requests are independently limited to one per User per ten minutes and five per rolling 24 hours.

Generate a separate canonical-base64 32-byte `PICK_REMINDERS_EMAIL_TOKEN_KEY` and bounded `PICK_REMINDERS_EMAIL_TOKEN_KEY_VERSION` outside retained command history. During rotation, configure the old pair as `PICK_REMINDERS_EMAIL_PREVIOUS_TOKEN_KEY` and `PICK_REMINDERS_EMAIL_PREVIOUS_TOKEN_KEY_VERSION`, deploy, and retain it for the 400-day opt-out lifetime or perform a documented security reset that invalidates old links. New tokens and email evidence always use the current key. Never reuse session, push, VAPID, Gmail, or database secrets.

Verification links expire after 24 hours, are single-use, and are superseded by a newer request. Verification persists through ordinary disable/re-enable while the normalized account-email evidence still matches. A changed account email disables email reminders until the current address is verified. Reminder opt-out links expire after 400 days and remain neutral and idempotent. Neither public landing page reveals User or League information.

SMTP 2xx acceptance is `ACCEPTED`; definite 4xx responses and Gmail daily-limit `550 5.4.5` are temporary; definite non-authentication 5xx recipient failures are permanent; timeout, reset, protocol, and uncertain-transmission failures are terminal `UNKNOWN`. Authentication rejection opens the durable Gmail breaker once. While open, queued email remains unclaimed, email status is temporarily unavailable, and push remains unaffected. Repair the credential, then deliberately change `PICK_REMINDERS_GMAIL_CREDENTIAL_VERSION` and deploy; a restart with the same version never resets the breaker.

Daily bounded cleanup removes no more than 100 expired/superseded verification requests and expired opt-out tokens per transaction. User deletion cascades all email setup. Expired 30-day access grace deletes verification, requests, opt-out tokens, preferences, and push subscriptions transactionally. Incident records may contain aggregate classifications and breaker state only—never addresses, tokens, URLs, message text, envelopes, responses, credentials, or User/League facts.

## Hidden push/PWA configuration (PR 3)

Keep master availability, push delivery, and public release off until the complete program is approved. Owner setup later requires `PUBLIC_APP_ORIGIN` as an exact HTTPS origin; one long-lived VAPID public/private pair plus a `mailto:` or HTTPS subject; a dedicated base64 32-byte `REMINDER_DATA_ENCRYPTION_KEY` and short version; and a separate base64 32-byte `PUSH_SUBSCRIPTION_DIGEST_KEY`. Generate values with maintained cryptographic tooling outside logs and source. Never paste values into tickets, chat, screenshots, retained commands, or fixtures.

## Shared calendar operations (hidden PR 5)

`PICK_REMINDERS_CALENDAR_AVAILABLE` is the calendar-only publication control. Missing, invalid, or false is off. It does not depend on email/push delivery controls; `PICK_REMINDERS_SYSTEM_AVAILABLE` governs authenticated discovery, not copied public feed possession. Keep the calendar control off until final launch approval.

The web process refreshes the active League Season schedule at startup and every 15 minutes. A trustworthy change commits stable event updates and a new feed representation atomically. A provider error leaves the previous ETag, Last-Modified, sequences, and body untouched. If no trustworthy representation exists, subscribers receive a valid empty calendar. Schedule corrections retain the UID and increment `SEQUENCE`; invalidated future events publish `STATUS:CANCELLED` for 30 days.

For an incident, first turn only `PICK_REMINDERS_CALENDAR_AVAILABLE` off. Existing subscribers then receive a cacheable empty calendar while durable publication state remains intact. Inspect sanitized `calendar_refresh_*` logs by counts/reason only; never capture provider bodies, request headers, IPs, or calendar-client identifiers. Repair upstream/configuration, deploy a forward correction if needed, confirm a trustworthy refresh, then obtain owner approval before re-enabling. Cache troubleshooting must compare the exact feed SHA-256/ETag and durable Last-Modified; client refresh may lag by many hours and is client-controlled.

Daily cleanup removes at most 100 confirmed events more than 30 days past their deadline and cancellations more than 30 days old. It never deletes the singleton last-trustworthy feed. Season rollover requires no URL or subscriber change.

PR 6 copy is maintained in `public/js/modules/calendar-instructions.js`. It is based on [Apple's subscription and removal guide](https://support.apple.com/guide/iphone/use-multiple-calendars-iph3d1110d4/ios), [Google Calendar's From URL and unsubscribe guide](https://support.google.com/calendar/answer/37188), and [Microsoft's Subscribe from web guide](https://support.microsoft.com/office/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web-cff1429c-5af6-41ec-a5b4-74f2c278e98c). Importing a file is not subscribing. Providers choose polling frequency—Microsoft warns updates can take more than 24 hours—and clients may override the feed's suggested alert.

For rotation, configure the new current key/version and the old key/version in `REMINDER_DATA_PREVIOUS_ENCRYPTION_KEY` and `REMINDER_DATA_PREVIOUS_ENCRYPTION_KEY_VERSION`. New registration updates encrypt with current; old rows remain readable only during the bounded rotation. After sanitized counts confirm no old-version rows, remove the prior pair. If a needed prior key is lost, restore it or invalidate affected subscriptions and require setup again.

HTTP 404/410 invalidates only the exact device. 408, 429, and 5xx are temporary; timeout or connection ambiguity becomes unknown and is never blindly resent. Emergency disablement uses the push switch first or the master switch for the feature; neither erases consent. Cleanup removes subscriptions on User deletion or after lost-access grace, while season rollover preserves them. Incident records and logs must never contain endpoints, keys, ciphertext, payloads, or request bodies.

PR 4 keeps the feature hidden and adds verified email. It still
cannot send while owner configuration and both operational controls remain
off. Calendar remains absent. The dashboard action remains disabled and there is
no ordinary-User settings route.

## Coordination and recovery

Every Heroku web process runs the same reminder coordinator after database
verification. Startup catch-up, an exact 24-hour-window timer, 30-second
recovery, and schedule changes call one durable evaluator. Campaign and delivery
uniqueness plus transactional claims make trigger overlap safe. No browser,
worker dyno, or external scheduler decides delivery.

Claims lease for two minutes. A definite temporary provider result retries
after 1, 5, and 15 minutes, for four total attempts. `UNKNOWN` is terminal and
must not be resent. An expired claim is conservatively recorded `UNKNOWN`, so a
crash after an ambiguous provider attempt cannot trigger a blind resend. Every
claim and attempt reloads the authoritative schedule, effective
feature access, preference, active Tracks, committed Picks, and deadline.

## Controls

`PICK_REMINDERS_SYSTEM_AVAILABLE`,
`PICK_REMINDERS_EMAIL_DELIVERY_AVAILABLE`,
`PICK_REMINDERS_PUSH_DELIVERY_AVAILABLE`, and
`PICK_REMINDERS_ADMIN_CAMPAIGN_AVAILABLE` are strict booleans and all default
false when absent or invalid. Leave every value absent/off for PR 2 production.
Do not configure a Gmail credential, VAPID key, push endpoint, or destination.
Public release also remains false in the database.

## Admin, observability, and retention

`SEND_PICK_REMINDERS` uses the ordinary ten-minute preview/confirmation
protocol, accepts no campaign input, and returns only aggregate facts. Campaign,
outbox, and actorless audit commit atomically; provider work occurs after commit.

Logs contain aggregate evaluated, eligible, durable claimed/retried, accepted,
unknown, temporary/permanent failure, suppression, retry exhaustion, and cleanup counts.
They exclude identities, destinations, Picks, Teams, content, endpoints,
payloads, credentials, tokens, sessions, environment values, and request bodies.

Daily cleanup deletes at most 100 old campaigns and keeps active plus immediately
previous League Season history. Expired access-removal grace deletes at most 100
preference rows; restored access keeps preferences. User deletion cascades
preferences and delivery identity. Migrations are additive and forward-only;
rollback turns controls off and preserves the tables for a forward correction.
