# Loser League agent instructions

Before changing this repository, read:

1. `docs/engineering/README.md`
2. `CONTEXT.md`
3. the relevant plan, ADR, architecture, behavior, and route documentation

`docs/refactor/` is historical evidence. Do not treat its behavior-preserving
scope or progress tracker as the default workflow for new work.

## Required conduct

- Inspect relevant code, callers, tests, and repository state before proposing
  or editing. Resolve discoverable facts yourself.
- Distinguish observed facts, documented requirements, assumptions, and
  proposals. Do not invent behavior or claim unrun checks passed.
- Preserve unrelated worktree changes and keep the requested scope intact.
- Stop for user approval before destructive actions, material scope expansion,
  or unresolved decisions that would change behavior or risk.
- Never expose or log secrets, credentials, sessions, request bodies, personal
  data, production data, or environment values.

## Planning

Use a grill-style planning session for every feature, architecture or schema
change, external integration, and ambiguous or cross-module bug. Resolve one
decision at a time and save the confirmed change contract from
`docs/plans/TEMPLATE.md` as `docs/plans/<short-name>.md` before implementation.

Clearly localized fixes may proceed from a reproduced failure and failing
regression test with a concise written scope.

## Implementation

- Add a failing regression test before a bug fix. Add tests alongside every
  behavior change at the approved HTTP, pure-function, or page-entry seams.
- Preserve existing contracts unless a confirmed change contract explicitly
  defines the break, consumers, migration, rollout, and rollback.
- Maintain the documented dependency direction. Keep Express out of domain
  logic, DOM access out of browser data modules, and process startup separate
  from application creation.
- Use forward-only migrations for schema changes and transactions for
  multi-write invariants. Never use shared development or production data in
  tests.
- Keep changes focused. Separate unrelated refactors, formatting, dependency
  upgrades, and speculative abstractions.
- Update relevant plans, behavior, routes, architecture, glossary, ADRs, and
  operations documentation with the code.
- Delete code only after reference searches and tests prove it unreachable or
  superseded.

## Verification and handoff

Run the relevant checks documented in `docs/engineering/README.md`. Database
tests require a disposable schema supplied through `TEST_DATABASE_URL` whose
name contains `test`.

Report exact commands and results, skipped or blocked checks, residual risk,
and the next safe step. A change is not complete when required code, tests,
documentation, migrations, or verification evidence is missing.
