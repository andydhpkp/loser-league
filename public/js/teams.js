import { nflTeams } from "./data/nfl-teams.js";
// You can already set Homescore > Awayscore to do what you want with the outcome of the game. If null than nothing, if tie than loss for both

import { getUserId, handleSubmitPicks } from "./modules/track-actions.js";
import { browserLogger } from "./logger.js";
import {
  fetchNflSchedule,
  fetchNflTeams,
  getLeagueSeasonYear,
} from "./modules/nfl-data.js";

let c;
let i;
let l;
let m;
let p;
let r;
let w;
let x;

//add logic so logged in users who have made their picks go straight to league view

//add button to originally create teams
//add button to manually check matchup

export { finalScores } from "./modules/team-results.js";

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

export async function getTrackNumber() {
  let userId = localStorage.getItem("loggedInUserId");

  if (!userId) {
    userId = await getUserId();
  }

  if (!userId) {
    browserLogger.error("Failed to get user ID.");
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
    browserLogger.debug("Error: ", error);
    //displayVenmoButton();
  }
}

function goToLeaguePage() {
  location.href = "../league-page.html";
}

export function getEndOfGameTime() {
  let currentMoment = new Date();

  let checkMatchupDay = currentMoment.getUTCDay();

  let checkMatchupHour = currentMoment.getUTCHours();

  browserLogger.debug("check day, then hour");

  browserLogger.debug(checkMatchupDay);
  browserLogger.debug(checkMatchupHour);

  //Utah is -7 or -6 UTC depending on daylight savings FYI

  if (checkMatchupDay === 2 && checkMatchupHour >= 7) {
    //matchupResult()
  }
}
//3600000
setInterval(getEndOfGameTime, 3600000);

async function getRecords(seasonYear, currentWeek) {
  try {
    const response = await fetchNflSchedule(seasonYear, currentWeek);
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
    browserLogger.error("Error in getRecords:", error);
  }
}

async function createTeams() {
  for (i = 0; i < nflTeams.length; i++) {
    let team_name = nflTeams[i].teamName;
    let team_logo = nflTeams[i].teamLogo;
    let team_record = nflTeams[i].teamRecord;

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
      browserLogger.debug("CREATED TEAM");
      browserLogger.debug(response);
    } else {
      alert(response.statusText);
    }
  }
}

export async function doTeamsExist() {
  fetch("/api/teams").then(function (response) {
    if (response.ok) {
      response.json().then(function (data) {
        browserLogger.debug(data);

        if (data.length < 32 || data.length > 32) {
          browserLogger.debug("DELETING ALL TEAMS AND RECREATING THEM");
          deleteAllTeams();
          createTeams();
        }
      });
    } else {
      alert("did not work");
    }
  });
}

async function deleteAllTeams() {
  const response = await fetch("/api/teams", { method: "DELETE" });
  if (!response.ok && response.status !== 404) {
    throw new Error("Unable to reset the team list");
  }
}

export function getCurrentWeek() {
  localStorage.setItem("thisWeek", "12");
}

export async function fetchMatchesAndGetCurrentWeek() {
  try {
    let response = await fetch("/api/proxy/nfl-2025");

    if (!response.ok) {
      throw new Error("Network response was not ok " + response.statusText);
    }

    let matches = await response.json();
  } catch (error) {
    browserLogger.error("There was a problem with the fetch operation:", error);
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
    const response = await fetchNflTeams();
    if (response.ok) {
      nflObj = await response.json();
    } else {
      throw new Error("Failed to retrieve nflObj");
    }
  } catch (error) {
    browserLogger.error("Error fetching the ESPN API", error);
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
          const seasonYear = getLeagueSeasonYear(data);
          if (seasonYear) {
            getRecords(seasonYear, currentWeek);
          } else {
            browserLogger.error("Unable to determine the League Season year.");
          }
        });
      } else {
        alert("didn't work");
      }
    })
    .catch(function (error) {
      browserLogger.debug("unable to connect");
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
