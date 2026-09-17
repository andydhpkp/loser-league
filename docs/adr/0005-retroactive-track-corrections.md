# ADR 0005: Retain void Picks and separate pot adjustments

Status: accepted in the confirmed retroactive buyback correction contract.

A mistaken reactivation can have later submitted or settled Picks. Deleting the
Track or merely editing its compatibility fields loses history or lets the next
projection rebuild restore the mistake. A counted buyback and an exceptional
reactivation also have different effects on the calculated pot.

Retain Picks with their factual Team, week and outcome. A nullable audit-operation
reference marks a Pick void for gameplay. Retain reactivation and buyback
membership records with an explicit reversal reference. Preserve original
terminal decisions and fulfillment resolutions for exact retry behavior; effective
buyback accounting excludes reversed memberships.

Pick and TrackReactivation default Sequelize scopes exclude void/reversed rows.
This is intentional: submission, automatic selection, closure, reminders and
projection rebuilds must see effective gameplay state. History readers use
unscoped queries explicitly and label voids/reversals. Rollover export includes
void status; whole-season cleanup explicitly includes scoped-out records. Existing
Pick uniqueness constraints remain: a correction does not authorize replaying a
void week or reactivating the same historical Wrong Pick again.

A keep-total correction creates a separate positive pot adjustment equal to the
actual contribution removed, in integer cents. It does not fabricate a fulfilled
buyback. Adjustment rows retain season/User/Track identifiers, a required
explanation and a unique audit-operation reference. User/Track identifiers are
historical references, not cascading foreign keys: later deletion must not silently
remove the adjustment. Disposable preseason resets clear its adjustments along
with gameplay; original correction evidence remains in the audit. Rollover retains
adjustments under the outgoing season, separate from successor-season totals.

All correction writes and audit records share one serializable transaction. Preview
and confirm use the same contribution queries and compare both User and league
amounts, Pick/Track state, memberships, decisions, schedule and season version.
Confirmation replay returns the original operation. Corrections are non-undoable
through generic Undo. No external payment or refund is implied.

This choice changes the behavior of ordinary model queries, so new history readers
must deliberately opt into unscoped access. Raw SQL gameplay readers must explicitly
filter void/reversed rows. An older application that ignores these columns is unsafe
after the first correction; recovery requires a forward application fix.
