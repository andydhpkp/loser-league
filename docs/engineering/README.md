# Engineering guide

This is the permanent standard for building, fixing, and maintaining Loser
League. It applies to features, defects, refactors, security work, operations,
and documentation. Historical refactor constraints remain in
[`../refactor/`](../refactor/README.md), but they are not the default workflow
for new work.

## Priorities

When rules compete, use this order:

1. Protect users, credentials, and data.
2. Preserve documented contracts unless a planned change explicitly replaces
   them.
3. Keep domain invariants and multi-write operations correct.
4. Prefer clear module boundaries and maintainable code.
5. Optimize delivery speed within the preceding constraints.

Never hide uncertainty to make work appear complete.

## Before changing code

### Establish the facts

- Read `AGENTS.md`, this guide, `CONTEXT.md`, and the documentation relevant to
  the area being changed.
- Inspect current callers, tests, data flows, and external interfaces. Search
  the repository instead of guessing.
- Reproduce a reported defect before selecting a fix. Record newly discovered
  behavior before depending on it.
- Distinguish observed behavior, documented requirements, assumptions, and
  proposed changes.

### Plan changes that need decisions

A grill-style planning session is required for:

- every feature;
- architectural or database-schema changes;
- new or materially changed external integrations; and
- ambiguous, cross-module, or high-risk defects.

The session must resolve decisions one at a time and produce a change contract
from [`../plans/TEMPLATE.md`](../plans/TEMPLATE.md). Save it as
`docs/plans/<short-name>.md` before implementation. The contract defines:

- user-visible behavior and explicit non-goals;
- acceptance criteria and important failure cases;
- affected routes, pages, data, integrations, and consumers;
- compatibility, migration, rollout, and rollback expectations;
- security and privacy risks;
- the test and verification strategy; and
- unresolved questions, owners, or follow-up work.

Clearly localized defects and routine maintenance may proceed without a
grilling session when their scope is established by a reproduced failure,
regression test, or equally direct evidence. Their issue or change description
must still state the scope and expected result.

Do not implement while a decision that materially changes behavior, risk, or
scope remains unresolved.

## Product language and behavior

Use the canonical product terms in [`../../CONTEXT.md`](../../CONTEXT.md).
Update the glossary as soon as a domain term is resolved. Keep it free of
implementation details.

Treat existing routes, methods, successful response bodies, page URLs, stored
data, and user workflows as compatibility contracts. An incompatible change is
allowed only when its change contract identifies:

- the intentional break;
- every known consumer;
- the migration and rollout path; and
- the fallback or rollback plan.

Without that explicit decision, a breaking change is a defect.

## Architecture and module design

Preserve the dependency direction documented in
[`../refactor/architecture.md`](../refactor/architecture.md):

```text
process startup
  -> application and transport adapters
    -> application/domain modules
      -> models, transactions, and external clients

page HTML
  -> one page entry module
    -> focused browser modules
      -> shared HTTP client
```

- HTTP adapters own request parsing and response mapping; they do not own
  league rules.
- Domain and application modules do not import Express or manipulate the DOM.
- Page entry modules own DOM event binding. Browser data modules do not reach
  through page structure.
- Do not reintroduce shared browser globals, inline event handlers, or script
  load-order dependencies.
- Keep process startup separate from application creation so the application
  remains testable.
- Prefer deep modules: a small stable interface that hides meaningful
  implementation detail.
- Accept variable dependencies at real seams. Avoid pass-through wrappers,
  speculative abstraction, and interfaces that merely mirror internals.
- Prefer pure transformations for pick state, week calculations, and other
  deterministic league rules.

An intentional departure from these boundaries requires a resolved design
decision before implementation. Record an ADR only when the decision is hard
to reverse, surprising without context, and represents a real trade-off.
Permanent ADRs live in `docs/adr/`.

## Test-driven changes

- Write a failing regression test before fixing a defect.
- Add tests with every behavior change before treating the work as complete.
- Test observable outcomes at stable seams, not private helpers or incidental
  call order.
- Use HTTP application instances for route behavior, exported pure functions
  for league transformations, and page entry modules for browser behavior.
- Include unhappy paths, boundary conditions, and unauthorized or abusive use
  where relevant.
- Documentation-only, configuration-only, and mechanical changes do not need a
  contrived failing test. Explain why no behavioral test applies.

Tests must be deterministic and isolated. Never make a test depend on
production services or mutable shared data.

## Database changes

- Evolve schemas only through reviewed, forward-only migrations included with
  the feature.
- Never use automatic schema synchronization as the migration mechanism for a
  shared environment.
- Include a rollback or recovery plan and consider compatibility while
  different application versions may be running.
- Protect multi-row and multi-field invariants with transactions.
- Exercise database behavior against disposable MySQL schemas supplied through
  `TEST_DATABASE_URL`.
- The test harness must reject database names that do not contain `test`.
- Never point tests, repair scripts, or experiments at production or the
  development database.

Data repair and destructive maintenance require an explicit target, a dry-run
or preview when practical, an audit-friendly summary, and a recovery plan.

## Security and privacy

- Validate and normalize untrusted input at system boundaries.
- Authenticate and authorize every protected operation on the server. Browser
  state is not proof of identity or permission.
- Keep credentials and secrets in environment-backed configuration. Never put
  them in source, browser assets, fixtures, examples, URLs, or logs.
- Redact passwords, session values, tokens, authorization headers, environment
  values, request bodies, and personal data from logs and errors.
- Use Sequelize or parameterized queries; never construct SQL with untrusted
  strings.
- Return safe, stable client errors. Do not expose database objects, stack
  traces, credentials, or internal exception details.
- Security-sensitive changes require tests for unauthorized and abusive paths,
  not only successful use.

Treat a suspected credential exposure or unauthorized data access as an
incident, not a routine defect.

## Errors and logging

- Expected failures use an application error with a stable code, safe message,
  and appropriate HTTP status.
- Unexpected failures return a generic 500 response and retain a request ID for
  correlation.
- Log each failure once, at the layer with enough request or operation context
  to make the event actionable.
- Supported levels are `error`, `warn`, `info`, and gated `debug`.
- Keep startup, shutdown, upstream failure, lock/conflict, batch summary, and
  unexpected failure events.
- Do not emit one success event per record or use unconditional browser debug
  output.

## Dependencies and tooling

Add a dependency only when the platform and existing dependencies cannot
reasonably solve the problem. The change contract or change description must
explain:

- its purpose and why existing options are insufficient;
- maintenance and security health;
- production, build, and operational impact; and
- lock-in and removal cost.

Commit intentional lockfile changes. Keep production dependencies minimal.
Introducing a framework, build system, formatter, or broad toolchain is a
separate planned change, not incidental cleanup.

Changed code must pass configured linters and follow the surrounding file's
style. Do not mix repository-wide formatting with behavioral work.

## Scope and deletion

Keep each change focused on one coherent purpose.

- Small, directly related cleanup is allowed when it reduces implementation
  risk and is protected by the same tests.
- Separate broad refactors, unrelated formatting, dependency upgrades, and
  speculative abstractions.
- Preserve unrelated worktree changes.
- Do not delete code until reference searches find no active caller, tests
  protect the surrounding behavior, the replacement is verified, and the
  removal is documented.
- Avoid compatibility wrappers without an identified consumer and removal
  plan.

## Documentation

Documentation is part of the change, not follow-up polish.

- Update product behavior, route contracts, architecture, operations, glossary,
  plans, and ADRs alongside the code they describe.
- Prefer one authoritative location and links over duplicated rules.
- Explain why a non-obvious constraint exists, not only what the code currently
  does.
- Keep examples executable and commands current.
- Preserve historical documents, but label them clearly so they are not
  mistaken for current instructions.

## Verification

Verification is risk-based during development and comprehensive before merge.

Run the fastest relevant checks after each small change:

```sh
npm run test:unit
npm run lint:browser
```

Run MySQL integration tests for route, model, transaction, migration, session,
or database behavior:

```sh
TEST_DATABASE_URL=mysql://user:password@127.0.0.1:3306/loser_league_test \
  npm run test:integration
```

Run browser smoke tests for page modules, HTML, navigation, browser HTTP
behavior, or user-visible interactions:

```sh
npm run test:smoke
```

Run the complete suite before merge:

```sh
npm test
```

CI should run every available required check. Until full-suite CI is
established, manual execution must be recorded explicitly. A skipped,
unavailable, or sandbox-blocked check is not a pass.

## Review and handoff

A pull request or handoff must include:

- the single purpose of the change;
- the change contract, issue, or reproduced defect;
- behavior and architectural impact;
- tests and documentation changed;
- exact verification commands and results;
- migration, deployment, and rollback notes where relevant; and
- residual risk, skipped checks, and follow-up work.

Unrelated formatting, generated noise, secrets, unexplained lockfile changes,
and unsupported claims block acceptance.

## Definition of done

A change is done only when:

1. agreed behavior and acceptance criteria are implemented;
2. relevant tests pass at approved seams;
3. security, compatibility, data, and failure paths are addressed;
4. documentation and migrations are included;
5. verification results and limitations are recorded; and
6. remaining risk and the next safe step are explicit.

## Emergency production fixes

An active incident may use an abbreviated workflow with explicit approval:

1. record the incident and impact;
2. reproduce or collect direct evidence when possible;
3. make the smallest safe, reversible change;
4. run targeted verification;
5. provide rollback instructions; and
6. add the regression test, full documentation, and change contract
   immediately afterward.

Security, authorization, secret-handling, and database-safety rules are never
waived.
