# Pick Reminders foundation operations

## Hidden verified-email configuration (PR 4)

Email remains off and hidden until the complete program is approved. Owner setup later must configure the approved `loserleague.reminders@gmail.com` address identically in `PICK_REMINDERS_EMAIL_FROM`, `PICK_REMINDERS_EMAIL_REPLY_TO`, and `PICK_REMINDERS_GMAIL_USER`; a dedicated Gmail app password in `PICK_REMINDERS_GMAIL_APP_PASSWORD`; and a deliberately managed `PICK_REMINDERS_GMAIL_CREDENTIAL_VERSION`. The account must have 2-Step Verification enabled. Generate the app password in Google Account security and store it only in protected Heroku configuration. Never use the normal Gmail password or paste either credential into source, tests, logs, tickets, screenshots, chat, or deployment transcripts.

SMTP uses authenticated TLS to `smtp.gmail.com:465`. The sender inbox and replies must be monitored by an organizer. Gmail acceptance means only that Gmail accepted the SMTP transaction; it does not prove inbox delivery or reading. Consumer Gmail currently documents a 500-message/day limit, and sending may pause for 1–24 hours after a limit. Verification requests are independently limited to one per User per ten minutes and five per rolling 24 hours.

Generate a separate canonical-base64 32-byte `PICK_REMINDERS_EMAIL_TOKEN_KEY` and bounded `PICK_REMINDERS_EMAIL_TOKEN_KEY_VERSION` outside retained command history. During rotation, configure the old pair as `PICK_REMINDERS_EMAIL_PREVIOUS_TOKEN_KEY` and `PICK_REMINDERS_EMAIL_PREVIOUS_TOKEN_KEY_VERSION`, deploy, and retain it for the 400-day opt-out lifetime or perform a documented security reset that invalidates old links. New tokens and email evidence always use the current key. Never reuse session, push, VAPID, Gmail, or database secrets.

Verification links expire after 24 hours, are single-use, and are superseded by a newer request. Verification persists through ordinary disable/re-enable while the normalized account-email evidence still matches. A changed account email disables email reminders until the current address is verified. Reminder opt-out links expire after 400 days and remain neutral and idempotent. Neither public landing page reveals User or League information.

SMTP 2xx acceptance is `ACCEPTED`; definite 4xx responses and Gmail daily-limit `550 5.4.5` are temporary; definite non-authentication 5xx recipient failures are permanent; timeout, reset, protocol, and uncertain-transmission failures are terminal `UNKNOWN`. Authentication rejection opens the durable Gmail breaker once. While open, queued email remains unclaimed, email status is temporarily unavailable, and push remains unaffected. Repair the credential, then deliberately change `PICK_REMINDERS_GMAIL_CREDENTIAL_VERSION` and deploy; a restart with the same version never resets the breaker.

Daily bounded cleanup removes no more than 100 expired/superseded verification requests and expired opt-out tokens per transaction. User deletion cascades all email setup. Expired 30-day access grace deletes verification, requests, opt-out tokens, preferences, and push subscriptions transactionally. Incident records may contain aggregate classifications and breaker state only—never addresses, tokens, URLs, message text, envelopes, responses, credentials, or User/League facts.

## Hidden push/PWA configuration (PR 3)

Keep master availability, push delivery, and public release off until the complete program is approved. Owner setup later requires `PUBLIC_APP_ORIGIN` as an exact HTTPS origin; one long-lived VAPID public/private pair plus a `mailto:` or HTTPS subject; a dedicated base64 32-byte `REMINDER_DATA_ENCRYPTION_KEY` and short version; and a separate base64 32-byte `PUSH_SUBSCRIPTION_DIGEST_KEY`. Generate values with maintained cryptographic tooling outside logs and source. Never paste values into tickets, chat, screenshots, retained commands, or fixtures.

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
