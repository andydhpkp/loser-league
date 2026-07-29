# ADR 0001: Behavior-preserving staged refactor

## Status

Accepted.

## Decision

Refactor in reviewable stages: documentation, characterization, server
foundation, server modules, browser modules, and proven-dead cleanup. Preserve
features, UI, schema, routes, and successful responses. Fix only verified
defects.

## Consequences

Coverage and documentation precede code movement. Some duplication remains
temporarily while tracer-bullet slices prove new module interfaces.
