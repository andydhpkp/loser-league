# Change contract: Remove admin numeric input spinners

## Problem and outcome

- The admin page's visible increment and decrement buttons on numeric fields add clutter without helping the admin workflow.
- Numeric fields should accept typed values without displaying browser spinner controls.
- Current behavior is established by the `type="number"` inputs in `public/admin.html` and their default browser rendering.

## Scope

- In scope: every numeric input rendered on the admin page.
- Explicitly out of scope: numeric inputs on other pages and changes to numeric parsing or validation.
- Affected workflow: shared-admin data entry only.

## Behavior

- User-visible behavior: numeric admin fields no longer show clickable up/down spinner buttons.
- Acceptance criteria: Chromium/WebKit and Firefox-compatible styling hides the controls on the admin page.
- Invariants: fields remain `type="number"`; typing, validation constraints, mobile numeric keyboards, and keyboard arrow behavior remain available.

## Interfaces and data

- Pages and browser interactions: `public/admin.html` and its page-scoped styles.
- Routes, response bodies, models, migrations, stored data, and external systems are unchanged.
- Compatibility: no existing HTTP or data contract changes.

## Design

- Add an admin-page body class and narrowly scoped CSS for number-input appearance.
- Avoid JavaScript because this is a rendering-only concern.
- No ADR is required.

## Safety and delivery

- Authentication, authorization, secrets, personal data, migrations, and observability are unchanged.
- Rollback is removal of the page class and scoped CSS rules.

## Verification

- Add a browser smoke assertion that an admin numeric input computes to text-field appearance.
- Run the focused smoke test and browser lint; broader required checks remain part of pre-PR verification.

## Decisions and open questions

- Resolved: admin page only; remove visible controls only; preserve numeric semantics and keyboard behavior.
- Open questions: none.

## Completion

- Documentation: this contract records the behavior.
- Residual risk: browser engines expose spinner pseudo-elements differently; vendor-specific and standard appearance rules cover supported engines.
- Next safe step: implement the scoped styling and verify it in Chromium.
