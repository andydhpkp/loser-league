# Historical refactor reference library

This directory preserves the evidence, contracts, and progress of the completed
behavior-preserving refactor. It is historical documentation, not the default
workflow for future changes. Current engineering rules live in
[`../engineering/README.md`](../engineering/README.md).

## Documents

- `behavior-baseline.md`: user-visible workflows and invariants.
- `route-contracts.md`: HTTP interfaces and their browser callers.
- `architecture.md`: current and target module maps.
- `refactor-rules.md`: non-negotiable implementation and safety rules.
- `known-issues.md`: suspected and confirmed defects.
- `progress.md`: current stage, evidence, and next steps.
- [`../adr/`](../adr/): permanent architectural decision records, including
  decisions made during the refactor.

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

## Historical status

Preserve these files as evidence of the refactor. Future changes should update
the current engineering guide, glossary, plan, ADRs, and relevant interface or
behavior documentation. `progress.md` is a final handoff record and is no
longer a required per-change log.
