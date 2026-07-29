# Loser League agent instructions

Before editing this repository, read:

1. `docs/refactor/README.md`
2. `docs/refactor/refactor-rules.md`
3. `docs/refactor/architecture.md`
4. `docs/refactor/progress.md`

The refactor is behavior-preserving. Do not introduce features, visual changes,
database-schema changes, or intentional successful-response changes.

## Required workflow

- Document newly discovered behavior before depending on it.
- Add or update a test at an approved seam before moving behavior.
- Keep route URLs, methods, page URLs, and successful response bodies stable.
- Use a disposable database identified by `TEST_DATABASE_URL` for integration
  tests. Never point tests at production or the development database.
- Update the relevant refactor documents in the same commit as code changes.
- Do not delete code until reference searches and tests prove it unreachable or
  superseded.
- Keep logs actionable, redact secrets, and emit each error once.

## Required verification

Run the checks documented in `docs/refactor/README.md`. Record results and the
next safe step in `docs/refactor/progress.md` before handing work off.
