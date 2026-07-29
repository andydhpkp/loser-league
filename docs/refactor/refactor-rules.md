# Refactor rules

## Scope

- Preserve features, visible UI, page URLs, route URLs, HTTP methods, successful
  payloads, and database schema.
- Fix only defects confirmed by characterization or direct wiring evidence.
- Do not add product behavior while restructuring code.

## Test-first movement

- Approved seams are HTTP routes, exported pure league logic, and browser page
  behavior.
- Add a failing characterization or regression test before changing behavior at
  a seam.
- Assert observable results, not private helpers or call order.
- Integration tests use only a disposable database whose name contains `test`.

## Module design

- Each module has one small interface and hides related implementation.
- Accept variable dependencies at real seams; do not add pass-through wrappers.
- Keep Express out of league logic and DOM access out of browser data modules.
- Prefer pure transformations for pick-array and week calculations.
- Multi-row or multi-field database workflows use transactions.

## Errors

- Expected failures become application errors with a stable code, safe message,
  and HTTP status.
- Unexpected errors become a generic 500 response; internal details appear only
  in one redacted log entry.
- Never send database objects, credentials, or stack traces as errors.

## Logging

- Supported levels are `error`, `warn`, `info`, and `debug`.
- Debug output is disabled unless `LOG_LEVEL=debug`.
- Keep startup, shutdown, upstream failure, lock/conflict, batch summary, and
  unexpected failure events.
- Do not log passwords, session values, request bodies, environment values, or
  one success line per record.
- Log a failure once, at the layer that has request or operation context.

## Deletion

Delete code only when:

1. repository searches find no active caller,
2. characterization or smoke coverage protects the surrounding behavior,
3. the replacement is verified, and
4. the removal is recorded in `progress.md` or an ADR.
