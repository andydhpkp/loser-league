# ADR 0004: Structured logging and safe errors

## Status

Accepted and implemented.

## Decision

Use structured server logging with `error`, `warn`, `info`, and gated `debug`
levels. Redact sensitive keys, summarize batch work, and return stable safe
error bodies. Browser diagnostics use a gated logger rather than unconditional
debug output.

## Consequences

Routine browser and per-record output no longer floods the console. Unexpected
request failures include a request ID and operational context without exposing
credentials or database details.
