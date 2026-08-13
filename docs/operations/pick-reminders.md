# Pick Reminders foundation operations

PR 2 is a hidden provider-neutral foundation. It cannot send real email or Web
Push because it contains no provider adapter, destination, credential, email
verification, or push subscription. The dashboard action remains disabled and
there is no ordinary-User settings route.

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
