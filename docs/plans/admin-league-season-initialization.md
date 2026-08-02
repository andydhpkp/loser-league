# Change contract: Admin League Season initialization

## Problem and outcome

- An empty database has no admin path to establish the first League Season.
- Season-dependent UI currently attempts NFL and preview requests, producing 502 and 409 responses.
- Admin should explicitly create a year as SETUP Week 0, enroll Users/Tracks, then explicitly start Week 1.

## Scope

- In scope: empty-state admin UI, audited creation of a League Season, audited activation of Week 1, and suppression of unavailable season operations.
- Out of scope: legacy Track adoption, historical lifecycle inference, automatic year selection, and later-week behavior.

## Behavior

- With no open League Season, show only a four-digit year field and Preview Create League Season.
- Creation requires no existing open season and no unassigned legacy Tracks. It creates SETUP Week 0.
- SETUP Week 0 permits enrollment and Track creation.
- Start Week 1 is separate and requires a validated Week 1 schedule whose earliest kickoff is in the future.
- Start preview shows year, User count, and Track count. Confirmation atomically changes SETUP Week 0 to ACTIVE Week 1.
- Both actions use persisted one-use previews, stale revalidation, transactions, and actorless audits.
- Other season controls remain unavailable until their lifecycle state applies.

## Interfaces and data

- Add `CREATE_LEAGUE_SEASON` and `START_LEAGUE_SEASON` to existing admin action preview/confirm routes.
- No migration or stored-data shape change is required.
- Existing CLI bootstrap remains the only legacy adoption path.

## Safety and delivery

- Shared-admin authorization remains mandatory.
- The year is an explicit four-digit value and is never clock-derived.
- Only one SETUP or ACTIVE League Season may exist.
- Missing/stale schedule evidence or elapsed kickoff fails without mutation.
- Rollback removes the UI/actions; committed League Season data is retained and corrected forward.

## Verification

- Unit tests cover action registry, browser intent, and invalid lifecycle state.
- Integration tests cover create, replay, start, missing schedule, elapsed kickoff, and stale confirmation.
- Browser smoke covers empty-state creation and SETUP start controls without failed automatic NFL requests.

## Decisions and open questions

- Resolved: explicit year; SETUP Week 0 creation; explicit Start Week 1; schedule and kickoff gate; audited previews; legacy CLI remains.
- Open questions: none.

## Completion

- Update admin and League Season operations documentation.
- Residual risk: Fixture schedule availability blocks activation by design.
- Next safe step: add failing action and browser tests.
