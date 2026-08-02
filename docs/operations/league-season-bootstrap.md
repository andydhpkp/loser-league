# League Season migration and bootstrap

The League Season foundation uses reviewed forward migrations and an explicit
bootstrap. Application startup never creates or changes shared database schema.

For a genuinely empty installation with no legacy Tracks, prefer the Admin
page's **Manage Week and League Season** workflow: enter the explicit year to
create SETUP Week 0, enroll Users and Tracks, then use **Start Week 1**. The CLI
workflow below remains required when existing unassigned legacy Tracks must be
adopted or reconciled.

## Deployment migration

Heroku runs the `release` command from `Procfile` before starting the new web
release:

```sh
npm run db:migrate
```

The command uses `JAWSDB_URL` in production. Do not print, retrieve, or copy the
configured URL. A migration failure blocks the new release. Existing additive
schema remains compatible with the prior application release so the web release
can be rolled back while a forward corrective migration is prepared.

The baseline migration adopts tables previously created through Sequelize
startup synchronization. It checks for those tables and columns before creating
them, then Sequelize records the baseline in `SequelizeMeta`. Repeating the
migration command after success is a no-op.

## Bootstrap safety boundary

Migrations add nullable League Season associations but do not guess the active
year, state, or week and do not read production Track data into logs.

Bootstrap requires all three values explicitly:

```sh
npm run league:bootstrap -- --year 2026 --state SETUP --week 0
```

The default is a read-only dry run. Its output contains only requested lifecycle
values, Track/Pick/elimination counts, and applied/already-applied status. It
never prints User data, Team selections, credentials, sessions, environment
values, database URLs, or raw Track state.

Review dry-run counts against an independently authorized operational count. Do
not use development or production data for tests or experiments.

Apply only after the exact lifecycle values are confirmed:

```sh
npm run league:bootstrap -- --year 2026 --state SETUP --week 0 --apply
```

For an active in-progress season, supply the exact authoritative week:

```sh
npm run league:bootstrap -- --year 2026 --state ACTIVE --week 3 --apply
```

The legacy schema cannot identify a prior buyback after `wrong_pick` was
cleared. Declare each known bought-back Track by numeric ID in both dry-run and
apply commands:

```sh
npm run league:bootstrap -- --year 2026 --state ACTIVE --week 3 \
  --week-one-buyback-track 42 --week-one-buyback-track 57
```

This marks each declared Track's Week 1 Pick factually `WRONG_PICK` while
leaving the Track active. Unknown, duplicate, invalid, empty-history, or still-
eliminated declarations fail closed. The command never prints the Track's User
or selected Team.

Bootstrap runs in one serializable transaction. It validates legacy Track
state, creates one open League Season, creates normalized weekly Picks with
migration-only `LEGACY_BACKFILL` origin, associates every Track, links eliminated
Tracks to their exact Wrong Pick, and commits everything together.

A failure changes nothing. Repeating the exact successful command verifies the
stored projection and returns an already-applied no-op. A conflicting year,
state, week, association, Pick, or elimination blocks the replay.

## Recovery

- Before bootstrap commit: correct the reported legacy-state reason through an
  approved repair path, then rerun the dry run.
- Failure during bootstrap: verify that no League Season or normalized Picks
  committed, then retry after correcting the cause.
- Response loss after commit: rerun the exact command for a verified no-op.
- Conflict after commit: stop. Prepare a reviewed forward corrective migration
  or repair command; do not delete or rewrite lifecycle tables.

The later contract migration may make `track.league_season_id` non-null only
after production bootstrap and parity verification are recorded.
