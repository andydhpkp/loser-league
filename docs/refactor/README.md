# Refactor reference library

This directory is the durable source of truth for the behavior-preserving
refactor. It is committed so work can resume without relying on chat history.

## Documents

- `behavior-baseline.md`: user-visible workflows and invariants.
- `route-contracts.md`: HTTP interfaces and their browser callers.
- `architecture.md`: current and target module maps.
- `refactor-rules.md`: non-negotiable implementation and safety rules.
- `known-issues.md`: suspected and confirmed defects.
- `progress.md`: current stage, evidence, and next steps.
- `decisions/`: architectural decision records.

## Approved test seams

1. HTTP routes through an Express application instance.
2. Pure league and pick transformations through exported functions.
3. Browser pages through page entry modules and browser smoke tests.

Tests assert observable outcomes at these interfaces. They do not mock or
inspect private implementation details.

## Verification commands

The commands will be enabled during the test-foundation stage:

```sh
npm run test:unit
npm run test:integration
npm run test:smoke
npm test
```

Integration tests require a disposable MySQL schema through
`TEST_DATABASE_URL`. The harness must reject any database name that does not
contain `test`.

## Maintenance

Update behavior, route, architecture, decision, or known-issue documentation in
the same commit that changes the corresponding code. Keep `progress.md` short,
current, and sufficient for a new session to resume safely.
