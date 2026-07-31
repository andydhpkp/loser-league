# loser-league
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow)](https://opensource.org/licenses/MIT)
## Table of Contents

* [Description](#description)
* [Status](#status)
* [Deployment](#deployment)
* [Usage](#usage)
* [License](#license)
* [Questions](#questions)
## Description
An application that will be used for the future 'Loser League' seasons between me and my friends. The concept is each user will pick a team to lose each week in the NFL season, and no repeat picks are allowed.

## Status
Current status is Users can create accounts and login, and they can manually input the amount of tracks that they have, and matchups will be randomly generated to show future format with future updates. Still need to add front-end for updating user information. Next step is making picks and preventing those picks from ever being selected in the same track again. 
## Deployment
https://loser-league.herokuapp.com/

Pushes to `main` are tested and deployed automatically through GitHub Actions.
Setup, verification, and rollback procedures are documented in
[`docs/operations/heroku-deploy.md`](docs/operations/heroku-deploy.md).

## Installation

To run this application locally, please do the following installation:

`
npm i
`

To seed the database, type in the following:

`
npm run seeds
`

Create a .env file in the root, and add the following with credentials:

`
DB_NAME='loser_league_db'
DB_USER='your_username'
DB_PW='your_password'
`

Copy `.env.example` to `.env`, provide a long random `SESSION_SECRET`, and set
`ODDS_API_KEY` to the credential from The Odds API. The ignored `.env` file is
the only local file that should contain the real credential.
The application targets Node.js 22 LTS.

Development and production commands:

```sh
npm run dev
npm start
```

## Verification

Fast module and route tests:

```sh
npm run test:unit
npm run test:unit:coverage
npm run lint:browser
```

MySQL integration tests require a disposable schema whose database name
contains `test`:

```sh
TEST_DATABASE_URL=mysql://user:password@127.0.0.1:3306/loser_league_test \
  npm run test:integration
```

Browser smoke tests run all five page entry modules against a static server:

```sh
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium
npm run test:smoke
```

Refactor architecture, behavior, route contracts, rules, decisions, and current
status are indexed in `docs/refactor/README.md`.

Contributors should follow the permanent engineering standards in
[`docs/engineering/README.md`](docs/engineering/README.md), use the canonical
product language in [`CONTEXT.md`](CONTEXT.md), and plan non-trivial changes
from [`docs/plans/TEMPLATE.md`](docs/plans/TEMPLATE.md). The refactor library is
retained as historical evidence.
## Usage
Up to current status, click on create account and enter information. Once in, enter number of tracks you want to have and click the button. The matchups will then be displayed and that is as far as I have gotten.

## License

This application is covered under the MIT license.
## Questions

Email for any questions at [Andrew Durham: andrewdurham1094@gmail.com](mailto:andrewdurham1094@gmail.com).
