# Change contract: Admin League pot counter

## Problem and outcome

The User requested an admin counter for $5 per original Track plus $10 per
completed buyback. A bought-back Track contributes $15 cumulatively. The User
confirmed Andydhpkp is Andrew Durham's account and approved excluding both its
original Tracks and buybacks. This is a calculated pot, not a payment ledger.

## Scope

Current League Season, or latest completed season when none is open. Show an
admin-only total, original-Track count/amount, and completed-buyback count/amount.
Include eliminated Tracks. Exclude pending, unfulfilled and cancelled buybacks,
other seasons, unassigned Tracks and the exempt account. No public pot display,
payment collection, refund tracking or changes to gameplay/buyback prices.

## Behavior

Display on Admin Home with a Refresh button. Initial load and explicit refresh
fetch authoritative server aggregates. Show unavailable on failure, never a
misleading zero or stale total. No season shows an explicit empty state.
Preseason amounts are clearly labelled as a test pot. Completed buybacks count
once per Track regardless of later elimination or exceptional correction.
Amounts use integer cents. Exemption follows the account ID, not a mutable name.

## Interfaces and data

Add authenticated GET /api/admin/pot returning only season context, counts and
amounts in cents. Add a dedicated league_pot_exemption table keyed by user_id.
A forward-only migration resolves the confirmed username case-insensitively
once and stores the ID. Reject ambiguous/missing matches in a populated database
before creating the table. An empty database may migrate without an exemption;
the counter remains unavailable until configured. No user-editable exemption
field: existing profile updates must not grant free Tracks.

## Design

Page entry owns button binding; a focused DOM module renders load/error states.
Server reporting module reads season, exemption and counts in one consistent
transaction. Shared-admin middleware protects the new endpoint. Count fulfilled
members only under completed decisions and matching season/Track ownership.
No additional runtime dependency or ADR is needed.

## Safety and delivery

No production data is read into agent output. Migration performs only the
explicitly authorized exemption registration. Missing/ambiguous identity fails
release safely. No credentials, names or account IDs in the API response or logs.
No profile or admin mutation can change the exemption. Source rollback leaves
the additive table intact; do not roll back schema or change buyback history.
Use normal tested PR/main deployment.

## Verification

Before implementation add HTTP authorization/aggregate tests, disposable-MySQL
integration coverage for paid/exempt, completed/partial/pending/cancelled,
season isolation, re-elimination and renamed exemption; migration identity and
rerun tests; browser entry tests for success, refresh, unavailable and mobile fit.
Run all five required PR gates from final committed source. No live-data tests.

## Decisions and open questions

The User confirmed the calculation, free account, stored buyback identification
and implementation. Read-only expected pot assumes the original $5 per Track;
actual receipts are not tracked. Display placement, manual refresh, test-pot
label, latest-completed fallback and dedicated exemption storage are bounded
implementation choices. Deleted Tracks are not an accounting ledger and no
historical payment retention is introduced by this feature.

## Completion

Update admin operations and NFL/buyback documentation as relevant. Record all
checks and migration/deployment evidence in the PR and handoff.
