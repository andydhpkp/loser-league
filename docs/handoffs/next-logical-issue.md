# Handoff: resolve issue #20 winner fact

Prepared: 2026-08-02

## Recommendation

After Issue #15 merges and deploys, resolve
[Issue #20](https://github.com/andydhpkp/loser-league/issues/20), **add the
winning crown**, as an operational fact rather than another crown-code change.

Winner Crown rendering and the audited shared-admin winner-record action are
already deployed. Issue #20 says only “Lorna won”; it does not identify the
League Season year or whether the win was solo or tied. Do not guess either
fact and do not write production data until the owner supplies both.

## Required workflow

1. Ask the owner for the exact League Season year and solo/tied result.
2. Use the existing Admin UI **Add solo win** or **Add tied win** action for the
   correct User and year. Admin is not a User; the operation remains actorless.
3. Verify the preview names the intended User, year, and win type before
   confirming. Do not retrieve or expose unrelated production User data.
4. Refresh the normal User/league view and visually confirm the corresponding
   supported crown appears.
5. Add sanitized operational evidence to Issue #20 and close it. No code PR is
   expected unless verification discovers an actual acceptance gap.

Issue #18, optional Google SSO, remains explicitly lowest priority and requires
a new grill-style external-integration plan before implementation.
