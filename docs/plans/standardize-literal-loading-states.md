# Change contract: Standardize literal loading states

> Superseded for spinner rollout scope by
> [`reduce-loading-indicators.md`](./reduce-loading-indicators.md). The later
> contract retains a spinner only for the whole-matchup loading workflow.

## Problem and outcome

- Several browser pages display only literal loading text while asynchronous
  data is pending, producing weaker visual feedback than the accessible spinner
  already used by the Pick matchup page.
- Every confirmed literal loading message displays the same visible Bootstrap
  spinner alongside concise accessible status text.
- The Help page's prominent **Open Pick Reminder Settings** call to action is
  visually recognizable as a Bootstrap button while remaining a navigation
  link.
- Repository inspection on 2026-08-14 established the affected messages in the
  Dashboard, Help, Pick Reminder Settings, admin, and Pick page browser files.

## Scope

- In scope:
  - Dashboard messages for the League Season summary, League access, and Pick
    status.
  - Help contact-option loading and the Pick Reminder Settings call to action.
  - Pick Reminder Settings page, push, email, and calendar loading messages.
  - Admin Pick Reminders release, aggregate reminder status, and game-odds
    loading messages.
  - Continued use of the existing compliant Pick matchup spinner through the
    shared presentation where practical.
  - Shared browser loading-indicator markup and reduced-motion styling.
- Explicitly out of scope:
  - A general audit or conversion of other buttons and links.
  - New pending states for asynchronous actions that do not currently render a
    literal loading message.
  - New duplicate-submission behavior.
  - Routes, APIs, schemas, authorization, League or Pick rules, and reminder
    delivery behavior.
- Affected workflows are visual loading feedback for authenticated Users and
  admins. Tracks and League Seasons are not changed.

## Behavior

- Each confirmed literal loading message contains a decorative Bootstrap
  spinner followed by its existing visible status text.
- The spinner is hidden from assistive technology. The containing status
  remains assistive-technology-readable and retains its existing live-region
  behavior.
- Existing success, empty, error, redirect, and retry paths replace the loading
  content as they do today, thereby removing the spinner.
- Spinner animation stops when the User requests reduced motion.
- **Open Pick Reminder Settings** remains an `<a href>` because it navigates to
  another page and gains Bootstrap button classes for its call-to-action
  presentation.
- All existing application behavior and link destinations remain invariant.

## Interfaces and data

- Routes, methods, and response bodies: unchanged.
- Pages and browser interactions: loading-status DOM content and one Help link's
  CSS classes change.
- Models, migrations, stored data, external systems, and consumers: unchanged.
- Compatibility: existing element IDs and status text remain stable for page
  modules and tests.

## Design

- A focused shared browser module creates loading-indicator content inside a
  caller-owned status region. Callers retain ownership of messages and all
  success, empty, error, retry, and redirect behavior.
- Shared CSS owns layout and reduced-motion behavior. It does not create a new
  component framework or page-level state machine.
- The design follows the documented browser dependency direction. No ADR is
  required.

## Safety and delivery

- Authentication and authorization are unchanged.
- No input, secrets, personal data, request bodies, or response bodies are
  newly rendered or logged.
- No migration or staged rollout is required. Rollback is a revert of the
  browser markup, module, CSS, tests, and this contract.
- Existing user-visible status messages remain the observable feedback.

## Verification

- Regression or characterization tests establish the current text-only states
  before implementation.
- Unit tests cover shared loading-indicator markup and replacement behavior.
- Browser smoke tests cover representative Dashboard, Help, Pick Reminder
  Settings, admin, and existing Pick loading states, including reduced motion
  and the Help link's semantics and Bootstrap styling.
- No integration or disposable database test is required for this browser-only
  behavior; run the repository's integration suite only if the full PR gate is
  requested.
- Run `npm run test:unit`, `npm run lint:browser`, and `npm run test:smoke` for
  development verification.

## Decisions and open questions

- Resolved on 2026-08-14:
  - Use one shared loading-indicator browser interface.
  - Qualify only UI states that currently render literal loading or waiting
    text.
  - Limit rollout to the enumerated Dashboard, Help, Pick Reminder Settings,
    admin, and existing Pick states.
  - Style only Help's **Open Pick Reminder Settings** call to action as a
    Bootstrap link button.
  - This focused contract intentionally supersedes issue #68's broader
    application-wide control audit and duplicate-submission scope.
- No open questions or external dependencies remain.

## Completion

- Update this contract and relevant browser testing standards if implementation
  discovers a material discrepancy.
- Residual risk is limited to status regions whose content is replaced by
  existing compact page code; representative smoke and unit tests cover removal
  of stale spinners.
- Next safe step: add failing tests, implement the shared indicator, and run the
  documented browser verification.
