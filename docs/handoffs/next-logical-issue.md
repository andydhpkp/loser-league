# Handoff: issue #12 — guided admin operations

Prepared: 2026-08-01

## Recommendation

Take [GitHub issue #12](https://github.com/andydhpkp/loser-league/issues/12),
**Expand admin tools with guided Track repair, weekly reset, audit, undo, and
help**, as the next substantive issue.

Issue #12 is the best next dependency-unlocking step:

- #14 explicitly needs its admin operations, authorization, documentation, and
  audit model.
- #17 explicitly builds its buyback reactivation workflow on #12.
- #11, #13, #14, and #19 converge on server-authoritative League Season/week
  state; starting one of those first would mix lifecycle work with an unresolved
  admin control plane.
- #15 depends on #14's current-League-Season Track association.
- #18 is explicitly marked lowest priority.
- #20 appears implemented by merged PRs #23–#26. Verify its result in `main`
  and close it separately as backlog housekeeping; do not start another crown
  implementation without finding a remaining acceptance gap.

This recommendation is sequencing judgment, not a claim that #12 is small or
already planned. It is a large authorization, schema, UI, and domain change.

## Starting repository state

At handoff time:

- the checkout is on `durham/fix-crown-matchups-admin-year` at `c45aa6e`;
- PR #26 for that branch is already merged on GitHub;
- `origin/main` in the local checkout was at `30a89fb` before fetching, so it
  may be stale;
- the worktree was clean;
- PR #21 (dedicated NFL routes) and PR #22 (tested Heroku deployment) are
  merged;
- the production deploy was recovered by configuring the required Heroku
  `SESSION_SECRET`, and workflow run `30649414968` passed tests, deployment,
  and production health verification.

Do not build issue #12 on the current merged feature branch. Start from fresh
remote `main` and create a dedicated branch:

```sh
git status --short --branch
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c codex/issue-12-admin-tools
```

If the first status command shows any new local changes, preserve them and stop
before switching branches until their ownership is understood.

## Required first actions in the new context

1. Read `AGENTS.md`, `docs/engineering/README.md`, and `CONTEXT.md` completely.
2. Read issue #12 from GitHub; do not rely only on this summary.
3. Read the current admin plan and operations documentation:
   - `docs/plans/admin-winner-tools.md`
   - `docs/operations/admin-access.md`
   - `docs/refactor/architecture.md` (architecture evidence only)
4. Inspect the current implementation and callers:
   - `server/admin/routes.js`
   - `server/admin/require-admin.js`
   - `server/app.js`
   - `public/admin.html`
   - `public/js/pages/admin.js`
   - `public/js/modules/admin-management.js`
   - `controllers/api/user-routes.js`
   - `controllers/api/track-routes.js`
   - `models/`
   - `test/unit/app.test.js`
   - `test/unit/admin-browser.test.js`
   - `test/unit/user-routes.test.js`
   - `test/unit/track-routes.test.js`
   - `test/integration/routes.test.js`
   - `test/smoke/admin-wins.spec.js`
5. Search all mutation routes and browser callers before defining the new admin
   boundary. Issue #12 requires existing add/delete operations to be audited,
   not only newly added repair actions.
6. Run the mandatory grill-style planning session one decision at a time, then
   save the confirmed contract as `docs/plans/admin-operations.md` using
   `docs/plans/TEMPLATE.md`. Do not implement before material decisions are
   resolved.

## Most important planning conflict

The current merged admin system intentionally uses one shared password and an
eight-hour server-side admin session. Issue #12 now requires both co-runners to
sign in through separate authenticated accounts, stores admin authority on the
server, and attributes every mutation to an authenticated admin User.

That is an intentional authentication contract change and must be resolved in
the grill. Confirm at least:

1. Which existing Loser League Users become admins and how the initial roles
   are assigned safely.
2. Whether the shared `ADMIN_PASSWORD` login is removed immediately, retained
   temporarily for migration/recovery, or kept under a separately documented
   break-glass flow.
3. Session migration and logout behavior for already-open shared-admin
   sessions.
4. The forward-only migration for admin authority and append-only audit data.
5. Rollout and rollback when application versions and schema versions overlap.

Do not infer admin authority from username, browser state, or client input.
Never put credentials, sessions, emails, request bodies, or unrelated personal
data in audit records or logs.

## Confirmed issue contract to preserve

Issue #12 requires:

- separate authenticated admin accounts for both co-runners;
- an admin-only Track inspector that excludes email and sensitive account data;
- guided domain actions rather than raw field editing;
- unmistakably separate selected-Track and all-Track current-week reset flows;
- previews bound to current state, explicit confirmation, and stale-preview
  rejection;
- transactional, concurrency-safe, idempotent mutations;
- append-only sanitized audit entries for every admin mutation, including
  existing add/delete operations;
- conditional undo only while affected records still match the committed
  after-state, with undo recorded as a new operation;
- an authenticated Admin Guide kept synchronized with the registered actions;
- preservation of Pick ordering, team eligibility, available/used disjointness,
  current Pick consistency, League Season scope, and prior-week eliminations.

## Suggested implementation shape

Treat this as one GitHub issue but deliver it in test-driven vertical slices on
one branch. A reasonable internal order, subject to the confirmed plan, is:

1. Admin identity/authorization migration and compatibility rollout.
2. Pure Track repair/reset planning functions with invariant validation.
3. Audit-operation model, state/version binding, and transaction service.
4. Read-only Track inspector and audit-history responses.
5. Preview/confirm endpoints for one narrowly defined guided action.
6. Selected-Track and all-Track weekly reset.
7. Remaining guided actions and conditional undo.
8. Shared action registry and authenticated Admin Guide.
9. Migrate existing admin mutations into the same authorization/audit boundary.
10. Browser interface, accessibility, full documentation, and rollout checks.

Keep Express in route adapters, domain transformations pure, transaction logic
server-side, and DOM binding in the admin page entry module. Do not expose raw
model rows as the inspector API.

## Test-first expectations

Before each behavior slice, add a failing test at the approved seam. Coverage
must include:

- non-admin and cross-account rejection;
- sensitive-field exclusion;
- invariant-preserving transformations for every guided action;
- selected versus all-Track reset;
- restoration only for a Wrong Pick caused by the current week;
- stale preview, duplicate request, and concurrent-admin conflicts;
- transaction rollback at every multi-write boundary;
- sanitized audit records and optional notes;
- safe and blocked undo;
- UI labels, confirmation, keyboard behavior, and guide access;
- a registry/guide completeness test.

Database tests must use a disposable MySQL schema from `TEST_DATABASE_URL`, and
the database name must contain `test`. Never print the configured URL or use
development/production data.

## Required verification before a PR

Run these against the final committed source state:

```sh
npm run test:unit
npm run test:unit:coverage
npm run lint:browser
TEST_DATABASE_URL=mysql://user:password@127.0.0.1:3306/loser_league_test npm run test:integration
npm run test:smoke
```

Use the already configured safe test URL where available; the example above is
a shape, not a credential. A skipped, blocked, unavailable, or known-failing
check blocks PR creation.

Before opening the PR, update the change contract plus relevant behavior,
routes, architecture, operations, security, glossary, migration, admin-guide,
rollout, rollback, and recovery documentation. Then use the repository's normal
publish flow to commit, push, and open the PR. Merging to `main` should trigger
the existing tested Heroku deployment; use the project `deploy-heroku` skill to
verify or troubleshoot that deployment without exposing config values.

## Copy/paste prompt for the next context

> Work on Loser League GitHub issue #12 as the next dependency-unlocking issue.
> Read `AGENTS.md`, `docs/engineering/README.md`, `CONTEXT.md`, and
> `docs/handoffs/next-logical-issue.md` first. Fetch remote state, start from
> fresh `main`, and create `codex/issue-12-admin-tools`. Use the required
> grill-style planning session and save `docs/plans/admin-operations.md` before
> implementation. Resolve the conflict between the current shared-password
> admin session and issue #12's separate authenticated admin accounts before
> coding. Implement test-first in vertical slices, preserve unrelated work,
> never use shared/production data for tests, and do not create a PR unless the
> complete repository verification gate passes.
