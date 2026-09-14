# Week 2 Track buyback operations

The Week 2 buyback is a season-scoped decision, not a payment processor.
Loser League stores only workflow state and the fact that shared admin confirmed
payment externally. Never enter Venmo transactions, messages, phone numbers,
emails, or payment details into notes or requests.

In preseason testing, the same workflow is available during any preseason
week for a Track currently eliminated by a Wrong Pick from any preseason week.
Preseason decisions have no kickoff deadline and remain available after the
final preseason week closes. Each User still receives only one decision in the
preseason session. Regular-season behavior below remains strictly Week 1 to
Week 2.

## User workflow

An authenticated User sees the offer only in active Week 2 before the earliest
validated kickoff when at least one owned Track is still eliminated by its
normalized Week 1 Wrong Pick and no Week 2 Pick exists. The popup lists exact
eligible Tracks at $10 each. Dismissal permits browsing but leaves every Pick
control and server submission blocked.

**Request selected buybacks** creates one immutable pending request. The User
cannot edit it and remains blocked until shared admin completes or cancels it,
or the deadline expires it. **No, continue without buying back** durably closes
the offer and immediately unlocks surviving active Tracks.

Missing or malformed schedule authority makes both decisions and Picks
temporarily unavailable. Restore validated Fixture Download evidence; never use
browser clocks or raw Track mutations as a workaround.

## Shared-admin workflow

Open `/admin.html` and choose **Manage Buybacks**. The same User-specific path
is linked from **Make Changes for a User**:

- **Pending requests** contains actionable User requests. Select the exact paid
  subset, confirm external payment, and complete. Every unselected requested
  Track is recorded unfulfilled in the same transaction. Use **Cancel request**
  only when no requested Track is fulfilled.
- **Eligible Users** prepares a direct admin buyback before the User requests.
  Select only paid eligible Tracks. Direct completion suppresses the rest of
  that User's offer for the League Season.
- **Recent history** is read-only evidence for terminal decisions and retries.

Completion revalidates the season, Week 2 window, decision version, ownership,
Week 1 Wrong Pick, and elimination under locks. It records the terminal
decision, each membership resolution, reactivation evidence, and sanitized
actorless audit in one transaction. Any failure rolls back all of them.

During preseason, the corresponding checks validate the active preseason
phase, the actual eliminating Wrong Pick from any preseason week, and current
elimination. There is no stored-schedule deadline check for preseason admin
resolution.

The separate **Exceptional Track correction** requires a written audit note.
It changes Track/reactivation state only and never changes buyback decision
history. Reserve it for explicit corrections, not normal buybacks.

## Deadline, recovery, and rollback

At the earliest Week 2 kickoff, auto-pick expires pending and unanswered
eligible decisions before selecting missing Picks for surviving active Tracks.
Unfulfilled eliminated Tracks are never selected. Startup catch-up, timers,
30-second recovery, and authenticated submission-state loads may wake the same
evaluator; database locks and durable operations make the result exactly once.

The migration is additive and forward-only. Application rollback leaves the
decision tables intact, but an older release does not enforce the gate. After
production decisions exist, prefer a forward fix. Normal completion is closed
at the deadline; late recovery requires the audited correction path and must
not rewrite the terminal decision.

Inspect only sanitized status, child resolutions, reactivation links, and audit
IDs. Never query or log sessions, environment configuration, raw requests,
User email, or payment details.

## Admin pot counter

The admin page shows the current League Season pot (latest completed season if
none is open). Refresh pot reads a new snapshot: every non-exempt current-season
Track contributes $5, including eliminated Tracks, and each fulfilled buyback
under a completed decision contributes another $10. A bought-back Track therefore
contributes $15 cumulatively. Pending, cancelled and unfulfilled buybacks do not
contribute. Re-elimination does not remove either contribution. Exceptional
reactivation alone is not evidence of a paid buyback.

The approved complimentary account is registered once by account ID in
`league_pot_exemption`; its Tracks and buybacks contribute zero. Profile fields
cannot alter the exemption, and a username change preserves it. The migration
fails before creating the table if an existing user population cannot uniquely
resolve the approved account. Empty databases may migrate without registration;
the counter displays unavailable until the exemption is configured. This is
intentional protection against an incorrect total.

`GET /api/admin/pot` requires shared-admin authentication, disables caching, and
returns only `leagueSeason` (year/schedulePhase), `trackCount`, `buybackCount`,
`baseCents`, `buybackCents`, and `totalCents`. With no season it returns
`{ "leagueSeason": null }`. Queries use one consistent transaction snapshot.
No account identity or payment details are returned. Errors clear displayed
amounts instead of leaving a stale total. Preseason values are labelled a test pot.

This is a calculated pot from retained Track/buyback records, not a receipts,
refunds or historical accounting ledger. Track deletion can change the amount.
See [the change contract](../plans/admin-league-pot.md).
