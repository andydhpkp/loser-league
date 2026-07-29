# ADR 0002: Native browser modules

## Status

Accepted.

## Decision

Use native ES modules with one page entry module per HTML page. Do not add a
frontend bundler.

## Consequences

Shared globals and inline event handlers can be removed without introducing a
build pipeline. Static hosting remains sufficient, and page script dependencies
become explicit.
