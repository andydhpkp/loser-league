# Change contract: Format calendar instructions

## Problem and outcome

- Apple, Google, and Outlook subscription/removal instructions currently render as one undifferentiated paragraph with no provider hierarchy.
- Keep one collapsed instruction disclosure while making its expanded content easy to scan on a phone.

## Scope

- Keep one **Apple, Google, and Outlook instructions** disclosure, collapsed by default.
- Inside it, render Apple Calendar, Google Calendar, and Outlook as separate sections with headings, **Subscribe** and **Remove** paragraphs, spacing, and divider lines.
- Render the shared refresh/notification limitation outside the disclosure so it is always visible.
- Preserve the meaning of the reviewed provider instructions.
- Do not change calendar URLs, feeds, deadlines, subscriptions, APIs, permissions, reminder delivery, or provider behavior.

## Interfaces and design

- `CALENDAR_INSTRUCTIONS` gains explicit provider titles and keeps provider copy as structured subscribe/remove fields.
- The reminder-settings page entry owns safe DOM construction; instructional data remains free of markup.
- Use one native `<details>` element for accessible collapsed/expanded behavior and semantic headings/paragraphs inside it.
- Use simple divider styling rather than nested cards.

## Safety and delivery

- No authentication, authorization, personal data, stored data, schema, route, or external integration changes.
- Rollback is a code revert with no data recovery requirements.

## Verification

- Browser coverage proves the disclosure starts collapsed, contains three provider sections with labeled copy, and leaves the limitation visible outside it.
- Unit coverage retains the provider subscribe/removal honesty contract.
- Run the complete repository PR gate before publication.

## Decisions

- One disclosure rather than three independent disclosures.
- Collapsed by default.
- Provider headings plus labeled paragraphs, separated by spacing/dividers.
- Shared limitation remains outside and always visible.
