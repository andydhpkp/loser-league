import { browserLogger } from "../logger.js";

let c;
let i;
let l;
let p;
let w;

export async function finalScores() {
  fetch("/api/proxy/nfl-2025").then(function (response) {
    if (response.ok) {
      response.json().then(async function (data) {
        let currentWeek = parseInt(localStorage.getItem("thisWeek"));
        let thisWeeksGames = [];
        let thisWeeksGamesCheckerMonday = [];
        let makeSureMondayGameIsDone = currentWeek - 1;
        let MondayGameFinished = true;
        if (makeSureMondayGameIsDone > 0) {
          for (c = 0; c < data.length; c++) {
            if (data[c].RoundNumber === makeSureMondayGameIsDone) {
              thisWeeksGamesCheckerMonday.push(data[c]);
            }
          }
          let lastGame =
            thisWeeksGamesCheckerMonday[
              Object.keys(thisWeeksGamesCheckerMonday)[
                Object.keys(thisWeeksGamesCheckerMonday).length - 1
              ]
            ];
          if (lastGame?.AwayTeamScore == null) {
            MondayGameFinished = false;
          }
        }
        for (w = 0; w < data.length; w++) {
          if (data[w].RoundNumber === currentWeek) {
            thisWeeksGames.push(data[w]);
          }
        }
        let textPicks = document.getElementsByClassName("teamNames");

        //TODO this should be called once at the beginnig onLoad()
        let { winners, losers } = await fetchScheduleData(currentWeek);

        for (i = 0; i < textPicks.length; i++) {
          let didTheyLoseTeamName = textPicks[i].children[0].innerText;

          if (winners.includes(didTheyLoseTeamName)) {
            textPicks[i].classList.add("loser");
            textPicks[i].classList.remove("winner");
          } else if (losers.includes(didTheyLoseTeamName)) {
            textPicks[i].classList.add("winner");
            textPicks[i].classList.remove("loser");
          }
        }

        let totalWinners = document.getElementsByClassName("winner");
        let totalLosers = document.getElementsByClassName("loser");

        if (
          totalWinners.length + totalLosers.length === textPicks.length &&
          textPicks.length > 0
        ) {
          for (l = 0; l < totalLosers.length; l++) {
            let deleteTrackId = parseInt(totalLosers[l].children[1].innerText);
            let loserTeam = totalLosers[l].children[0].innerText;
            addLoser(deleteTrackId, loserTeam);
          }
          //THIS IS A BANDAID UNTIL YOU SEE HOW ESPN UPDATES RECORDS BY TUESDAY
          for (p = 0; p < thisWeeksGames.length; p++) {
            if (
              thisWeeksGames[p].AwayTeamScore > thisWeeksGames[p].HomeTeamScore
            ) {
              postWinnerRecord(thisWeeksGames[p].AwayTeam, [1, 0]);
              postLoserRecord(thisWeeksGames[p].HomeTeam, [0, 1]);
            }
            if (
              thisWeeksGames[p].HomeTeamScore > thisWeeksGames[p].AwayTeamScore
            ) {
              postWinnerRecord(thisWeeksGames[p].HomeTeam, [1, 0]);
              postLoserRecord(thisWeeksGames[p].AwayTeam, [0, 1]);
            }
            if (
              thisWeeksGames[p].AwayTeamScore ===
              thisWeeksGames[p].HomeTeamScore
            ) {
              postWinnerRecord(thisWeeksGames[p].AwayTeam, [1, 0]);
              postWinnerRecord(thisWeeksGames[p].HomeTeam, [1, 0]);
            }
          }
          await resetCurrentPicks();
        }
      });
    }
  });
}

async function resetCurrentPicks() {
  try {
    const response = await fetch("api/tracks/all-tracks/reset-current-pick", {
      method: "PUT",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    browserLogger.debug("Success:", data);
  } catch (error) {
    browserLogger.error("Error:", error);
  }
}

async function fetchScheduleData(weekNumber) {
  try {
    const response = await fetch(
      `https://pacific-anchorage-21728.herokuapp.com/https://cdn.espn.com/core/nfl/schedule?xhr=1&year=2025&week=${weekNumber}`
    );
    const data = await response.json();

    let winners = [];
    let losers = [];

    for (let date in data.content.schedule) {
      data.content.schedule[date].games.forEach((game) => {
        if (game.status.type.completed) {
          const competitors = game.competitions[0].competitors;
          const homeTeam = competitors.find((c) => c.homeAway === "home");
          const awayTeam = competitors.find((c) => c.homeAway === "away");

          // Check if it's a tie by comparing scores
          const homeScore = homeTeam.score;
          const awayScore = awayTeam.score;

          if (homeScore === awayScore) {
            // It's a tie - both teams should be in winners array (bad picks)
            winners.push(homeTeam.team.displayName);
            winners.push(awayTeam.team.displayName);
          } else {
            // Normal win/loss
            competitors.forEach((competitor) => {
              if (competitor.winner) {
                winners.push(competitor.team.displayName);
              } else {
                losers.push(competitor.team.displayName);
              }
            });
          }
        }
      });
    }

    browserLogger.debug("Winners:", winners);
    browserLogger.debug("Losers:", losers);

    return { winners, losers };
  } catch (error) {
    browserLogger.error("Error fetching the schedule data:", error);
    return { winners: [], losers: [] };
  }
}

async function fetchScheduleOdds(weekNumber) {
  try {
    const response = await fetch(
      `https://pacific-anchorage-21728.herokuapp.com/https://cdn.espn.com/core/nfl/schedule?xhr=1&year=2025&week=${weekNumber}`
    );
    const data = await response.json();

    let oddsDetails = [];

    for (let date in data.content.schedule) {
      data.content.schedule[date].games.forEach((game) => {
        // Extracting odds details
        if (
          game.competitions[0].odds &&
          game.competitions[0].odds.length > 0 &&
          game.competitions[0].odds[0].details
        ) {
          oddsDetails.push(game.competitions[0].odds[0].details);
        }
      });
      browserLogger.debug(data);
    }
    browserLogger.debug(oddsDetails);
    return oddsDetails;
  } catch (error) {
    browserLogger.error("Error fetching schedule odds:", error);
    throw error; // Propagating the error
  }
}

async function postWinnerRecord(winnerId, team_record) {
  const response = await fetch(`/api/teams/team/${winnerId}`, {
    method: "PUT",
    body: JSON.stringify({
      team_record,
    }),
    headers: { "Content-Type": "application/json" },
  });
  if (response.ok) {
    browserLogger.debug("RECORD UPDATED");
  } else {
    alert(response.statusText);
  }
}

async function resetAllTeamRecords() {
  const response = await fetch(`/api/teams/reset-records`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
  });

  if (response.ok) {
    browserLogger.debug("All team records reset to 0-0");
  } else {
    alert(response.statusText);
  }
}

async function postLoserRecord(loserId, team_record) {
  const response = await fetch(`/api/teams/team/${loserId}`, {
    method: "PUT",
    body: JSON.stringify({
      team_record,
    }),
    headers: { "Content-Type": "application/json" },
  });
  if (response.ok) {
    browserLogger.debug("RECORD UPDATED");
  } else {
    alert(response.statusText);
  }
}

async function getTeam(teamId) {
  const response = await fetch(`/api/teams/${teamId}`, {});
  if (response.ok) {
    response.json().then(function (data) {
      browserLogger.debug(data);
      let teamName = data.team_name;
      browserLogger.debug(teamName);
      return teamName;
    });
  } else {
    alert(response.statusText);
  }
}

async function addLoser(trackId, loserTeam) {
  try {
    // Fetch the current state of the track data
    let trackResponse = await fetch(`api/tracks/${trackId}`);

    if (!trackResponse.ok) {
      throw new Error(trackResponse.statusText);
    }

    let trackData = await trackResponse.json();

    // Only proceed if wrong_pick is null
    if (trackData.wrong_pick === null) {
      let response = await fetch(`api/tracks/${trackId}/loser`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wrong_pick: loserTeam,
        }),
      });

      if (response.ok) {
        browserLogger.debug("it worked");
      } else {
        alert(response.statusText);
      }
    } else {
      browserLogger.debug("wrong_pick is not null, so not proceeding with the update");
    }
  } catch (error) {
    alert("Failed to fetch or update data: " + error.message);
  }
}

async function getAllTracks() {
  const response = await fetch(`/api/tracks`, {});
  if (response.ok) {
    response.json().then(function (data) {
      browserLogger.debug(data);
      let tracksObj = data;
      browserLogger.debug(tracksObj);
      return tracksObj;
    });
  }
}
