// You can already set Homescore > Awayscore to do what you want with the outcome of the game. If null than nothing, if tie than loss for both

//const { parse } = require("dotenv");

//add logic so logged in users who have made their picks go straight to league view

//add button to originally create teams
//add button to manually check matchup

//Maybe do the espn one just for Monday night? Seems easier to have the random time update
/* async function finalScores() {
    fetch(`http://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`).then(function(response) {
        if(response.ok) {
            response.json().then(function(data) {
                console.log(data)
                for(i=0; i<data.events)
            })
        }
    })
} */

async function finalScores() {
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
          if (lastGame.AwayTeamScore == null) {
            MondayGameNotFinished = true;
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
    console.log("Success:", data);
  } catch (error) {
    console.error("Error:", error);
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

    console.log("Winners:", winners);
    console.log("Losers:", losers);

    return { winners, losers };
  } catch (error) {
    console.error("Error fetching the schedule data:", error);
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
      console.log(data);
    }
    console.log(oddsDetails);
    return oddsDetails;
  } catch (error) {
    console.error("Error fetching schedule odds:", error);
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
    console.log("RECORD UPDATED");
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
    console.log("All team records reset to 0-0");
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
    console.log("RECORD UPDATED");
  } else {
    alert(response.statusText);
  }
}

async function getTeam(teamId) {
  const response = await fetch(`/api/teams/${teamId}`, {});
  if (response.ok) {
    response.json().then(function (data) {
      console.log(data);
      let teamName = data.team_name;
      console.log(teamName);
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
        console.log("it worked");
      } else {
        alert(response.statusText);
      }
    } else {
      console.log("wrong_pick is not null, so not proceeding with the update");
    }
  } catch (error) {
    alert("Failed to fetch or update data: " + error.message);
  }
}

async function getAllTracks() {
  const response = await fetch(`/api/tracks`, {});
  if (response.ok) {
    response.json().then(function (data) {
      console.log(data);
      let tracksObj = data;
      console.log(tracksObj);
      return tracksObj;
    });
  }
}

let nflArray2 = [
  {
    teamName: "San Francisco 49ers",
    teamLogo: "../css/assets/san-francisco-49ers-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Arizona Cardinals",
    teamLogo: "../css/assets/arizona-cardinals-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Atlanta Falcons",
    teamLogo: "../css/assets/atlanta-falcons-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Baltimore Ravens",
    teamLogo: "../css/assets/baltimore-ravens-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Buffalo Bills",
    teamLogo: "../css/assets/buffalo-bills-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Philadelphia Eagles",
    teamLogo: "../css/assets/philadelphia-eagles-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Carolina Panthers",
    teamLogo: "../css/assets/carolina-panthers-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Chicago Bears",
    teamLogo: "../css/assets/chicago-bears-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Cincinnati Bengals",
    teamLogo: "../css/assets/cincinnati-bengals-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Cleveland Browns",
    teamLogo: "../css/assets/cleveland-browns-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Dallas Cowboys",
    teamLogo: "../css/assets/dallas-cowboys-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Denver Broncos",
    teamLogo: "../css/assets/denver-broncos-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Detroit Lions",
    teamLogo: "../css/assets/detroit-lions-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Green Bay Packers",
    teamLogo: "../css/assets/green-bay-packers-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Houston Texans",
    teamLogo: "../css/assets/houston-texans-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Indianapolis Colts",
    teamLogo: "../css/assets/indianapolis-colts-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Jacksonville Jaguars",
    teamLogo: "../css/assets/jacksonville-jaguars-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Kansas City Chiefs",
    teamLogo: "../css/assets/kansas-city-chiefs-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Los Angeles Chargers",
    teamLogo: "../css/assets/los-angeles-chargers-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Miami Dolphins",
    teamLogo: "../css/assets/miami-dolphins-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Minnesota Vikings",
    teamLogo: "../css/assets/minnesota-vikings-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "New England Patriots",
    teamLogo: "../css/assets/new-england-patriots-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "New Orleans Saints",
    teamLogo: "../css/assets/new-orleans-saints-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "New York Giants",
    teamLogo: "../css/assets/new-york-giants-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "New York Jets",
    teamLogo: "../css/assets/new-york-jets-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Las Vegas Raiders",
    teamLogo: "../css/assets/oakland-raiders-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Pittsburgh Steelers",
    teamLogo: "../css/assets/pittsburgh-steelers-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Los Angeles Rams",
    teamLogo: "../css/assets/Rams-icon.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Seattle Seahawks",
    teamLogo: "../css/assets/seattle-seahawks-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Tampa Bay Buccaneers",
    teamLogo: "../css/assets/tampa-bay-buccaneers-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Tennessee Titans",
    teamLogo: "../css/assets/tennessee-titans-logo.png",
    teamRecord: [0, 0],
  },
  {
    teamName: "Washington Commanders",
    teamLogo: "../css/assets/Washington-Commanders-icon.png",
    teamRecord: [0, 0],
  },
];

function displayVenmoButton() {
  let sectionHelp = document.getElementById("games");

  let nothingDiv = document.createElement("div");

  nothingDiv.style.display = "flex";
  nothingDiv.style.flexDirection = "column"; // Stack the items vertically
  nothingDiv.style.alignItems = "center"; // Horizontal centering
  nothingDiv.style.justifyContent = "center";
  nothingDiv.style.marginBottom = "20px";

  let nothingMessageH1 = document.createElement("h1");
  nothingMessageH1.innerHTML =
    "It looks like you do not have any tracks... try texting Tate";
  nothingDiv.appendChild(nothingMessageH1);

  // Create the Venmo button
  let venmoLink = document.createElement("a");
  venmoLink.href = "https://account.venmo.com/u/TateBenson28";
  venmoLink.target = "_blank"; // Opens the link in a new browser tab
  venmoLink.rel = "noopener noreferrer"; // Security measure for opening new tabs

  let venmoLogo = document.createElement("img");
  venmoLogo.src = "../css/assets/venmo.svg"; // Update this path to where your Venmo logo is stored
  venmoLogo.alt = "Venmo Logo";
  venmoLogo.style.width = "50px"; // You can adjust this to fit your needs
  venmoLogo.style.marginRight = "10px"; // A little space between the logo and text

  venmoLink.appendChild(venmoLogo);
  venmoLink.appendChild(document.createTextNode("Give Tate some money"));

  venmoLink.style.display = "inline-flex"; // Flex to align logo and text
  venmoLink.style.alignItems = "center"; // Vertical centering
  venmoLink.style.padding = "0px 10px 0px 10px";
  venmoLink.style.backgroundColor = "#3d95ce"; // Venmo blue color
  venmoLink.style.color = "white";
  venmoLink.style.textDecoration = "none";
  venmoLink.style.borderRadius = "5px";
  venmoLink.style.marginTop = "20px"; // Adds some space between the message and the button

  nothingDiv.appendChild(venmoLink);

  sectionHelp.appendChild(nothingDiv);
}

async function getTrackNumber() {
  let userId = localStorage.getItem("loggedInUserId");

  if (!userId) {
    userId = await getUserId();
  }

  if (!userId) {
    console.error("Failed to get user ID.");
    return;
  }

  let currentWeek = parseInt(localStorage.getItem("thisWeek"));
  let totalTracks = 0;
  let trackIdArray = [];
  let trackIdToUsedPicksMap = {};

  try {
    const response = await fetch(`/api/tracks/user/${userId}/alive`);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const data = await response.json();

    totalTracks = data.length;

    if (totalTracks === 0) {
      goToLeaguePage();
    }

    for (let i = 0; i < totalTracks; i++) {
      trackIdArray.push(data[i].id);
    }
    for (let i = 0; i < totalTracks; i++) {
      trackIdToUsedPicksMap[data[i].id] = data[i].used_picks;
    }
    currentWeek++;
    let picksCompleteChecker = false;
    if (trackIdArray.length > 0) {
      let picksCompleteHelper = 0;
      for (let r = 0; r < totalTracks; r++) {
        if (data[r].used_picks.length >= currentWeek) {
          picksCompleteHelper++;
        }
      }
      if (picksCompleteHelper === totalTracks) {
        picksCompleteChecker = true;
      }
    }
    if (picksCompleteChecker) {
      //location.href = "../league-page.html"
    }
    await matchup(totalTracks, trackIdArray, trackIdToUsedPicksMap); // Assuming matchup is an async function
    if (trackIdArray.length === 0) {
      displayVenmoButton();
    }
  } catch (error) {
    console.log("Error: ", error);
    //displayVenmoButton();
  }
}

function goToLeaguePage() {
  location.href = "../league-page.html";
}

function getEndOfGameTime() {
  let currentMoment = new Date();

  let checkMatchupDay = currentMoment.getUTCDay();

  let checkMatchupHour = currentMoment.getUTCHours();

  console.log("check day, then hour");

  console.log(checkMatchupDay);
  console.log(checkMatchupHour);

  //Utah is -7 or -6 UTC depending on daylight savings FYI

  if (checkMatchupDay === 2 && checkMatchupHour >= 7) {
    //matchupResult()
  }
}
//3600000
setInterval(getEndOfGameTime, 3600000);

async function espnFetchScoreboard() {
  fetch(
    "https://pacific-anchorage-21728.herokuapp.com/https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
  ).then(function (response) {
    if (response.ok) {
      response.json().then(function (data) {
        console.log(data);
      });
    }
  });
}

async function espnFetchTeam() {
  fetch(
    "https://pacific-anchorage-21728.herokuapp.com/https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams"
  ).then(function (response) {
    if (response.ok) {
      response.json().then(function (data) {
        console.log(data);
      });
    }
  });
}

async function getRecords(currentWeek) {
  try {
    const response = await fetch(
      `https://pacific-anchorage-21728.herokuapp.com/https://cdn.espn.com/core/nfl/schedule?xhr=1&year=2025&week=${currentWeek}`
    );
    if (!response.ok) {
      throw new Error("Failed to fetch data.");
    }

    const data = await response.json();
    let records = {};

    for (let date in data.content.schedule) {
      data.content.schedule[date].games.forEach((game) => {
        game.competitions[0].competitors.forEach((competitor) => {
          records[competitor.team.displayName] = competitor.records[0].summary;
        });
      });
    }

    let recordHTML = document.getElementsByClassName("record");

    for (let i = 0; i < recordHTML.length; i++) {
      let teamName = recordHTML[i].previousSibling.innerText;
      if (records[teamName]) {
        let splitRecord = records[teamName].split("-");
        let finalRecord;

        if (splitRecord.length > 2) {
          finalRecord = `(${splitRecord[0].trim()} - ${splitRecord[1].trim()} - ${splitRecord[2].trim()})`;
        } else {
          finalRecord = `(${splitRecord[0].trim()} - ${splitRecord[1].trim()})`;
        }

        recordHTML[i].innerText = finalRecord;
      }
    }
  } catch (error) {
    console.error("Error in getRecords:", error);
  }
}

async function createTeams() {
  for (i = 0; i < nflArray2.length; i++) {
    let team_name = nflArray2[i].teamName;
    let team_logo = nflArray2[i].teamLogo;
    let team_record = nflArray2[i].teamRecord;

    const response = await fetch("/api/teams", {
      method: "post",
      body: JSON.stringify({
        team_name,
        team_logo,
        team_record,
      }),
      headers: { "Content-Type": "application/json" },
    });
    if (response.ok) {
      console.log("CREATED TEAM");
      console.log(response);
    } else {
      alert(response.statusText);
    }
  }
}

async function doTeamsExist() {
  fetch("/api/teams").then(function (response) {
    if (response.ok) {
      response.json().then(function (data) {
        console.log(data);

        if (data.length < 32 || data.length > 32) {
          console.log("DELETING ALL TEAMS AND RECREATING THEM");
          deleteAllTeams();
          createTeams();
        }
      });
    } else {
      alert("did not work");
    }
  });
}

function getCurrentWeek() {
  localStorage.setItem("thisWeek", "6");
}

// async function getCurrentWeek() {
//   try {
//     const response = await fetch(
//       "https://pacific-anchorage-21728.herokuapp.com/https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
//       {
//         header: {
//           "X-Requested-With": "XMLHttpRequest",
//         },
//       }
//     );

//     if (!response.ok) {
//       throw new Error(
//         `HTTP error! Status: ${response.status} - ${response.statusText}`
//       );
//     }

//     const data = await response.json();
//     console.log(data);
//     const currentDate = getMyDate(); // Current date and time in UTC

//     const league = data.leagues[0];
//     const regularSeasonCalendar = league.calendar.find(
//       (item) => item.label === "Regular Season"
//     );

//     if (!regularSeasonCalendar) {
//       throw new Error("Could not find the Regular Season data");
//     }

//     let firstStartDate = new Date(regularSeasonCalendar.startDate);
//     firstStartDate.setHours(firstStartDate.getHours() - 16); // Subtract 16 hours

//     for (const entry of regularSeasonCalendar.entries) {
//       const startDate = new Date(entry.startDate);
//       startDate.setHours(startDate.getHours() - 16); // Subtract 16 hours

//       const endDate = new Date(entry.endDate);
//       endDate.setHours(endDate.getHours() - 16); // Subtract 16 hours

//       if (currentDate >= startDate && currentDate <= endDate) {
//         // localStorage.setItem("thisWeek", "1");
//         console.log("This is the current data: " + currentDate);
//         console.log("this is the start date: " + startDate);
//         console.log("this is the end date: " + endDate);
//         console.log("This is the current week: " + entry.value);
//         //THIS IS WHERE TO CHANGE
//         // localStorage.setItem("thisWeek", entry.value.toString());
//         // localStorage.setItem("thisWeek", "21");
//         return entry.value; // Return the value directly
//       }
//       console.log("IT GETS TOOOOOO HERERERERERERE");
//     }

//     if (currentDate < firstStartDate) {
//       localStorage.setItem("thisWeek", "1");
//       // return "2"; // Return the value directly
//     }

//     //TEMPORARY FOR PLAYOFFS

//     localStorage.setItem("thisWeek", "1");

//     return null;
//   } catch (error) {
//     console.error("Error fetching data:", error);
//     return null;
//   }
// }

function getMyDate() {
  const today = new Date();
  //for testing different days
  //today.setDate(today.getDate() + 15);
  return today;
}

async function fetchMatchesAndGetCurrentWeek() {
  try {
    let response = await fetch("/api/proxy/nfl-2025");

    if (!response.ok) {
      throw new Error("Network response was not ok " + response.statusText);
    }

    let matches = await response.json();
  } catch (error) {
    console.error("There was a problem with the fetch operation:", error);
  }
}

function getCurrentWeekForMatchFetch(matches) {
  // Group matches by RoundNumber
  let rounds = {};
  matches.forEach((match) => {
    if (!rounds[match.RoundNumber]) {
      rounds[match.RoundNumber] = [];
    }
    rounds[match.RoundNumber].push(match);
  });

  // Find the current week
  for (let [roundNumber, roundMatches] of Object.entries(rounds)) {
    if (
      roundMatches.every(
        (match) => match.HomeTeamScore !== null && match.AwayTeamScore !== null
      )
    ) {
      // This round is complete, so continue to the next round
      continue;
    } else {
      // This round is not complete, so it is the current week
      return roundNumber;
    }
  }

  // If all rounds are complete, return the last round number
  return Object.keys(rounds).pop();
}

// Call the async function to fetch matches and get the current week
async function matchup(totalTracks, trackIds, usedPicksMap) {
  let nflObj = {};
  try {
    const response = await fetch(
      "https://pacific-anchorage-21728.herokuapp.com/https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams"
    );
    if (response.ok) {
      nflObj = await response.json();
    } else {
      throw new Error("Failed to retrieve nflObj");
    }
  } catch (error) {
    console.error("Error fetching the ESPN API", error);
  }

  let containerNumber = totalTracks;
  const container = document.getElementById("gameMatchups");
  const main = document.getElementById("games");
  const actions = document.getElementById("trackActions");
  const getLoading = document.getElementById("loading");

  container.innerHTML = "";

  var nflScoreApi = "/api/proxy/nfl-2025";
  fetch(nflScoreApi)
    .then(function (response) {
      if (response.ok) {
        response.json().then(function (data) {
          let currentWeek = parseInt(localStorage.getItem("thisWeek"));

          let headerHelp = document.getElementsByTagName("header")[0];
          let currentWeekDiv = document.createElement("div");
          let currentWeekH1 = document.createElement("h1");
          currentWeekH1.innerHTML = `Week ${currentWeek}`;
          currentWeekDiv.appendChild(currentWeekH1);
          headerHelp.appendChild(currentWeekDiv);

          let thisWeeksGames = [];

          for (w = 0; w < data.length; w++) {
            if (data[w].RoundNumber === currentWeek) {
              thisWeeksGames.push(data[w]);
            }
          }

          let thisWeeksMatchups = [];

          for (m = 0; m < thisWeeksGames.length; m++) {
            thisWeeksMatchups.push(
              thisWeeksGames[m].HomeTeam,
              thisWeeksGames[m].AwayTeam
            );
          }

          let matchupsLogos = [];
          let matchupRecords = [];
          let teamSlugs = []; // Store team slugs for reliable matching

          for (l = 0; l < thisWeeksMatchups.length; l++) {
            for (x = 0; x < nflObj.sports[0].leagues[0].teams.length; x++) {
              if (
                thisWeeksMatchups[l] ===
                nflObj.sports[0].leagues[0].teams[x].team.displayName
              ) {
                matchupsLogos.push(
                  nflObj.sports[0].leagues[0].teams[x].team.logos[0].href
                );
                matchupRecords.push([0, 0]);
                teamSlugs.push(nflObj.sports[0].leagues[0].teams[x].team.slug);
              }
            }
          }

          let matchupRecordsFormat = [];
          let matchups = [];
          let logos = [];
          let info = [];
          let chooser = 0;

          for (r = 0; r < thisWeeksMatchups.length; r++) {
            let wins = matchupRecords[r][0].toString();
            let losses = matchupRecords[r][1].toString();
            let record = `(${wins} - ${losses})`;
            matchupRecordsFormat.push(record);
          }

          while (matchups.length < thisWeeksMatchups.length) {
            let firstTeam = thisWeeksMatchups[chooser];
            let firstTeamLogo = matchupsLogos[chooser];
            let firstTeamRecord = matchupRecordsFormat[chooser];

            chooser++;

            let secondTeam = thisWeeksMatchups[chooser];
            let secondTeamLogo = matchupsLogos[chooser];
            let secondTeamRecord = matchupRecordsFormat[chooser];

            matchups.push(firstTeam);
            matchups.push(secondTeam);
            info.push(firstTeamRecord);
            info.push(secondTeamRecord);
            logos.push(firstTeamLogo);
            logos.push(secondTeamLogo);

            chooser++;
          }

          // Create tracks as expandable dropdowns
          for (i = 0; i < containerNumber; i++) {
            let logoCounter = 0;

            // Create main track container
            let trackDropdown = document.createElement("div");
            // Add both classes so handleSubmitPicks() can find these containers
            trackDropdown.setAttribute(
              "class",
              "track-dropdown trackContainer"
            );
            trackDropdown.setAttribute("id", trackIds[i]);

            // Create collapsed header
            let trackHeader = document.createElement("div");
            trackHeader.setAttribute("class", "track-header");

            let trackLabel = document.createElement("span");
            trackLabel.setAttribute("class", "track-label");
            trackLabel.innerText = `TRACK ${i + 1}`;

            let selectedTeamLogo = document.createElement("img");
            selectedTeamLogo.setAttribute("class", "selected-team-logo hidden");

            trackHeader.appendChild(trackLabel);
            trackHeader.appendChild(selectedTeamLogo);

            // Create expandable content
            let trackContent = document.createElement("div");
            trackContent.setAttribute("class", "track-content collapsed");

            // Hidden input for form submission
            let hiddenInput = document.createElement("input");
            hiddenInput.setAttribute("type", "hidden");
            hiddenInput.setAttribute("class", "tempSelection");

            // Add click handler to header for expand/collapse
            trackHeader.addEventListener("click", function () {
              // Close all other dropdowns first
              document
                .querySelectorAll(".track-dropdown")
                .forEach((dropdown) => {
                  if (dropdown !== trackDropdown) {
                    dropdown
                      .querySelector(".track-content")
                      .classList.add("collapsed");
                    dropdown.classList.remove("expanded");
                  }
                });

              // Toggle current dropdown
              trackContent.classList.toggle("collapsed");
              trackDropdown.classList.toggle("expanded");
            });

            // Create matchup options
            for (let l = 0; l < thisWeeksGames.length; l++) {
              let individualMatchup = document.createElement("div");
              individualMatchup.setAttribute("class", "individual-matchup");

              // --- First team elements ---
              let firstTeamButton = document.createElement("button");
              let firstAnchor = document.createElement("a");
              let firstTeamName = document.createElement("h2");
              let firstTeamInfo = document.createElement("h3");
              firstTeamInfo.className = "record";
              let teamLogoFirst = document.createElement("img");

              // Capture FIRST team's values BEFORE advancing the counter
              const firstTeamLogoSrc = logos[logoCounter];
              const firstTeamNameStr = matchups[logoCounter];
              const firstTeamRecordStr = info[logoCounter];

              firstTeamButton.setAttribute("class", "teamSelection");
              firstTeamButton.setAttribute(
                "data-value",
                `${trackIds[i]},${firstTeamNameStr}`
              );
              // Also store the logo directly on the button so the handler is trivial
              firstTeamButton.dataset.logo = firstTeamLogoSrc;

              teamLogoFirst.setAttribute("class", "teamLogos");
              teamLogoFirst.src = firstTeamLogoSrc;
              teamLogoFirst.alt = `${firstTeamNameStr} logo`;

              firstTeamName.innerText = firstTeamNameStr;
              firstTeamInfo.innerText = firstTeamRecordStr;

              firstAnchor.appendChild(teamLogoFirst);
              firstAnchor.appendChild(firstTeamName);
              firstAnchor.appendChild(firstTeamInfo);
              firstTeamButton.appendChild(firstAnchor);

              // FIRST team click handler uses the captured logo via dataset
              firstTeamButton.addEventListener("click", function () {
                selectTeam(
                  this,
                  hiddenInput,
                  trackDropdown,
                  trackContent,
                  selectedTeamLogo,
                  this.dataset.logo
                );
              });

              // Advance to SECOND team
              logoCounter++;

              // --- Second team elements ---
              let secondTeamButton = document.createElement("button");
              let secondAnchor = document.createElement("a");
              let secondTeamName = document.createElement("h2");
              let secondTeamInfo = document.createElement("h3");
              secondTeamInfo.className = "record";
              let teamLogoSecond = document.createElement("img");

              // Capture SECOND team's values
              const secondTeamLogoSrc = logos[logoCounter];
              const secondTeamNameStr = matchups[logoCounter];
              const secondTeamRecordStr = info[logoCounter];

              secondTeamButton.setAttribute("class", "teamSelection");
              secondTeamButton.setAttribute(
                "data-value",
                `${trackIds[i]},${secondTeamNameStr}`
              );
              secondTeamButton.dataset.logo = secondTeamLogoSrc;

              teamLogoSecond.setAttribute("class", "teamLogos");
              teamLogoSecond.src = secondTeamLogoSrc;
              teamLogoSecond.alt = `${secondTeamNameStr} logo`;

              secondTeamName.innerText = secondTeamNameStr;
              secondTeamInfo.innerText = secondTeamRecordStr;

              secondAnchor.appendChild(teamLogoSecond);
              secondAnchor.appendChild(secondTeamName);
              secondAnchor.appendChild(secondTeamInfo);
              secondTeamButton.appendChild(secondAnchor);

              // SECOND team click handler uses its own captured logo
              secondTeamButton.addEventListener("click", function () {
                selectTeam(
                  this,
                  hiddenInput,
                  trackDropdown,
                  trackContent,
                  selectedTeamLogo,
                  this.dataset.logo
                );
              });

              // Check for used picks for this track and mark buttons
              let currentTracksUsedPicks = usedPicksMap[trackIds[i]];
              for (let j = 0; j < currentTracksUsedPicks.length; j++) {
                if (
                  currentTracksUsedPicks[j].trim() === firstTeamNameStr.trim()
                ) {
                  firstTeamButton.classList.add("used_pick");
                }
                if (
                  currentTracksUsedPicks[j].trim() === secondTeamNameStr.trim()
                ) {
                  secondTeamButton.classList.add("used_pick");
                }
              }

              // Create and add the VS label between buttons
              let vs = document.createElement("h1");
              vs.innerText = "VS";
              vs.setAttribute("class", "vs");

              // Append to the matchup row
              individualMatchup.appendChild(firstTeamButton);
              individualMatchup.appendChild(vs);
              individualMatchup.appendChild(secondTeamButton);
              trackContent.appendChild(individualMatchup);

              // Advance to next pair
              logoCounter++;
            }

            trackContent.appendChild(hiddenInput);
            trackDropdown.appendChild(trackHeader);
            trackDropdown.appendChild(trackContent);
            container.appendChild(trackDropdown);
          }

          const submitBtn = document.createElement("button");
          submitBtn.id = "submitPicksBtn";
          submitBtn.className = "btn btn-primary";
          submitBtn.innerText = "Submit Picks";
          submitBtn.addEventListener("click", handleSubmitPicks);

          // Insert just above Logout
          actions.insertBefore(submitBtn, document.getElementById("logoutBtn"));

          getLoading.remove();
          getRecords(currentWeek);
        });
      } else {
        alert("didn't work");
      }
    })
    .catch(function (error) {
      console.log("unable to connect");
    });
}

// Helper function to handle team selection
function selectTeam(
  button,
  hiddenInput,
  trackDropdown,
  trackContent,
  selectedTeamLogo,
  logoSrc
) {
  // Update hidden input
  hiddenInput.value = button.getAttribute("data-value");

  // Remove selected class from all buttons in this track
  trackContent.querySelectorAll(".teamSelection").forEach((btn) => {
    btn.classList.remove("selected");
  });

  // Add selected class to clicked button
  button.classList.add("selected");

  // Update track appearance
  trackDropdown.classList.add("successfulPick", "selected-track");

  // Update selected team logo
  selectedTeamLogo.src = logoSrc;
  selectedTeamLogo.classList.remove("hidden");

  // Collapse the dropdown
  trackContent.classList.add("collapsed");
  trackDropdown.classList.remove("expanded");
}
