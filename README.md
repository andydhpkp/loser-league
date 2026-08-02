# Loser League

[![License: MIT](https://img.shields.io/badge/license-MIT-yellow)](https://opensource.org/licenses/MIT)

Loser League is a private NFL elimination-pick game for a group of friends. It
reverses the usual survivor-pool premise: each week, every active entry picks
an NFL team expected to **lose**. If the selected team wins or ties, that entry
is eliminated.

The application manages the competition from preseason setup through weekly
picks, results, standings, and season rollover. It includes a player-facing web
experience and a separate shared-admin workspace for running the league.

## How the game works

- A **User** can own one or more independent **Tracks** in a League Season.
- Each active Track makes one Pick per weekly round.
- A Track cannot select the same NFL team more than once in the same Pick
  cycle; different Tracks owned by one User choose independently.
- A Pick is correct when the selected team loses.
- A winning or tied selected team produces a **Wrong Pick** and eliminates that
  Track without eliminating the User's other Tracks.
- Eligible Tracks eliminated in Week 1 may receive a one-time Week 2 buyback
  offer. Payment is handled outside the application.
- At season completion, solo or tied winners are recorded in each User's win
  history and represented by Winner Crown artwork when available.

The canonical product vocabulary and detailed definitions live in
[`CONTEXT.md`](CONTEXT.md).

## What the application does

### For Users

- Register, log in, reset a password, and maintain a server-backed session.
- View a dashboard summarizing the current League Season and Pick status.
- Review weekly NFL matchups and submit one final selection for every active
  Track.
- See used Picks, current Picks, eliminated Tracks, league standings, and
  weekly statistics.
- Request or decline an eligible Week 2 buyback.
- Access an authenticated Help page with league rules and organizer contacts.

### For league administrators

- Create and start a League Season, manage Users and Tracks, and add Tracks in
  bulk.
- Preview and confirm audited league operations instead of applying invisible
  data changes.
- Assign or replace Picks, reconcile results, reactivate eligible Tracks, and
  rebuild compatibility projections.
- Resolve Week 2 buyback requests after confirming payment externally.
- Close weeks, complete a season, record winning Tracks, export rollover data,
  and initialize the next League Season.

Weekly deadlines, missing-Pick auto-selection, result settlement, and season
advancement are server-authoritative and transactionally protected. External
NFL schedule and result data is used to support these workflows; credentials
remain on the server.

## Main pages

| Page | Purpose |
| --- | --- |
| `/index.html` | User login, password reset, and shared-admin access |
| `/create-account.html` | User registration |
| `/dashboard.html` | Authenticated season and Pick summary |
| `/profile.html` | Track details, matchup review, Pick submission, and buyback decisions |
| `/league-page.html` | League standings and weekly statistics |
| `/help.html` | Authenticated rules and support information |
| `/admin.html` | Shared-admin league operations |

## Technology

- Node.js 22 and Express
- MySQL with Sequelize and forward-only migrations
- Server-backed sessions with bcrypt password hashing
- Browser-native JavaScript modules and static HTML/CSS
- Node's built-in test runner, Supertest, ESLint, and Playwright
- GitHub Actions deployment to Heroku

## Local development

### Prerequisites

- Node.js 22.x
- npm
- MySQL

Install dependencies:

```sh
npm install
```

Copy `.env.example` to `.env` and replace its placeholder values. At minimum,
local startup requires database credentials, a long random `SESSION_SECRET`,
the shared `ADMIN_PASSWORD`, and an `ODDS_API_KEY` from The Odds API. Keep real
credentials only in the ignored `.env` file.

Create the configured MySQL database, then apply the schema migrations:

```sh
npm run db:migrate
```

Optional development seed data can be loaded with:

```sh
npm run seeds
```

Start the application in development mode:

```sh
npm run dev
```

For production-style startup, use `npm start`. Startup verifies database
connectivity but never creates or changes the schema. Initial League Season
setup is a separate, dry-run-first process documented in
[`docs/operations/league-season-bootstrap.md`](docs/operations/league-season-bootstrap.md).

## Testing

Fast checks that do not require a database:

```sh
npm run test:unit
npm run test:unit:coverage
npm run lint:browser
```

Integration tests require a disposable MySQL schema whose database name
contains `test`:

```sh
TEST_DATABASE_URL=mysql://user:password@127.0.0.1:3306/loser_league_test \
  npm run test:integration
```

Browser smoke tests use Playwright:

```sh
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium
npm run test:smoke
```

See [`docs/engineering/README.md`](docs/engineering/README.md) for the complete
verification requirements, architecture boundaries, and contribution rules.

## Deployment and operations

The production application is available at
[loser-league.herokuapp.com](https://loser-league.herokuapp.com/). Pushes to
`main` are tested and deployed automatically through GitHub Actions.

Operational procedures are documented in [`docs/operations/`](docs/operations/),
including deployment verification and rollback, weekly closure, auto-picks,
buybacks, guided repairs, and season bootstrap.

## Documentation

- [`CONTEXT.md`](CONTEXT.md): canonical product language
- [`docs/engineering/README.md`](docs/engineering/README.md): current engineering standards
- [`docs/engineering/lifecycle-program-summary.md`](docs/engineering/lifecycle-program-summary.md): server-authoritative season lifecycle overview
- [`docs/refactor/README.md`](docs/refactor/README.md): historical refactor evidence and interface documentation
- [`docs/plans/TEMPLATE.md`](docs/plans/TEMPLATE.md): change-contract template for non-trivial work

## License

This project is covered under the MIT License.

## Questions

Contact [Andrew Durham](mailto:andrewdurham1094@gmail.com).
