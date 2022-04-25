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
## Usage
Up to current status, click on create account and enter information. Once in, enter number of tracks you want to have and click the button. The matchups will then be displayed and that is as far as I have gotten.

## License

This application is covered under the MIT license.
## Questions

Email for any questions at [Andrew Durham: andrewdurham1094@gmail.com](mailto:andrewdurham1094@gmail.com).