# ADR 0003: Test seams and disposable MySQL

## Status

Accepted.

## Decision

Test behavior at HTTP route, pure league-logic, and browser-page seams.
Database integration tests use a disposable MySQL schema supplied through
`TEST_DATABASE_URL`; the harness rejects database names without `test`.

## Consequences

Tests remain stable across internal movement while exercising real Sequelize
and MySQL behavior. Production and development data are outside the test
interface.
