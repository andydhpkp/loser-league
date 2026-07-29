# Change contract: Community feedback

## Problem and outcome

- The public repository accepts Issues but presents contributors with an
  unstructured, developer-oriented form.
- GitHub Discussions are disabled, leaving no obvious place for informal
  questions or notes.
- Non-technical league participants should have clear paths for requesting a
  change, reporting a problem, or starting an informal conversation.

## Scope

- In scope:
  - enable repository Discussions;
  - add plain-language issue forms for change requests and problem reports;
  - configure the issue chooser to direct informal notes to Discussions.
- Explicitly out of scope:
  - anonymous submissions;
  - intake outside GitHub;
  - automated prioritization or implementation;
  - changing application behavior.
- Affected workflow: public repository feedback intake.

## Behavior

- The new-issue chooser offers **Request a change** and
  **Report a problem**.
- An **Ask a question or share a note** link opens repository Discussions.
- Blank Issues are disabled so contributors receive useful prompts.
- Forms warn contributors not to submit passwords, private contact details, or
  other sensitive information.
- Existing Issues and application behavior remain unchanged.

## Interfaces and data

- Repository configuration lives under `.github/ISSUE_TEMPLATE/`.
- GitHub Issues and Discussions store public contributor-supplied content.
- No application routes, pages, models, migrations, or production data change.

## Design

- Use GitHub-native issue forms and Discussions, requiring no new service,
  dependency, hosting, or payment.
- Keep required fields minimal and use non-technical language.
- Do not add a general blank Issue option.
- No ADR is required because the configuration is small and reversible.

## Safety and delivery

- GitHub authentication and repository permissions control submission and
  moderation.
- Forms explicitly warn against posting sensitive information.
- Rollback consists of reverting the form files or disabling Discussions.
- No secrets or personal data are added to source.

## Verification

- Validate the issue-form YAML parses successfully.
- Confirm GitHub reports Discussions enabled.
- Confirm the public new-issue chooser exposes both forms and the Discussions
  link after deployment.
- Application unit, integration, and browser tests do not apply because this
  change does not alter application code or runtime behavior.

## Decisions and open questions

- Resolved: GitHub accounts are required; forms cover requests and problems;
  Discussions cover informal notes and questions.
- Open questions: none.

## Completion

- Documentation: this change contract and the issue-form configuration.
- Residual risk: contributors may still publish information despite the
  warning; repository maintainers must moderate public content.
- Next safe step: publish the configuration to the default branch and verify
  the public chooser.
