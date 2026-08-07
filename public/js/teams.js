import { nflTeams } from "./data/nfl-teams.js";
// You can already set Homescore > Awayscore to do what you want with the outcome of the game. If null than nothing, if tie than loss for both

import { getUserId, handleSubmitPicks } from "./modules/track-actions.js";
import { browserLogger } from "./logger.js";
import {
  fetchNflSchedule,
  fetchNflTeams,
} from "./modules/nfl-data.js";
import { renderOnboardingPanel } from "./modules/zero-track-onboarding.js";
import { renderBuyback } from "./modules/week-two-buyback.js";
import {
  showMatchupEmpty,
  showMatchupError,
  showMatchupLoading,
  showMatchupReady,
} from "./modules/matchup-page-state.js";

let c;
let i;
let l;
let m;
let p;
let r;
let x;

//add logic so logged in users who have made their picks go straight to league view

//add button to originally create teams
//add button to manually check matchup

export { finalScores } from "./modules/team-results.js";

let matchupInitialization;

export function getTrackNumber() {
  if (matchupInitialization) return matchupInitialization;
  showMatchupLoading();
  matchupInitialization = loadMatchupPage().finally(() => {
    matchupInitialization = null;
  });
  return matchupInitialization;
}

async function loadMatchupPage() {
  let currentWeek;
  let totalTracks = 0;
  let trackIdArray = [];
  let trackIdToUsedPicksMap = {};
  let trackStateMap = {};

  try {
    const response = await fetch("/api/user/league/submission");
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const state = await response.json();
    renderBuyback(state.buyback);
    const data = state.tracks;
    currentWeek = state.leagueSeason.week;
    if (state.message) {
      const status = document.createElement("p");
      status.className = "alert alert-warning";
      status.setAttribute("role", "status");
      status.textContent = state.message;
      document.getElementById("actions")?.prepend(status);
    }

    totalTracks = data.length;

    if (state.onboarding) {
      const container = document.getElementById("gameMatchups");
      renderOnboardingPanel(container, state.onboarding, { onRefresh: () => window.location.reload() });
      showMatchupReady();
      return;
    }

    if (data.length === 0) {
      if (state.buyback?.pickBlocked) {
        showMatchupReady();
        return;
      }
      showMatchupEmpty("No active Tracks are available.");
      return;
    }

    for (let i = 0; i < totalTracks; i++) {
      trackIdArray.push(data[i].id);
    }
    for (let i = 0; i < totalTracks; i++) {
      trackIdToUsedPicksMap[data[i].id] = data[i].usedTeamNames;
      trackStateMap[data[i].id] = data[i];
    }
    let picksCompleteChecker = false;
    if (trackIdArray.length > 0) {
      let picksCompleteHelper = 0;
      for (let r = 0; r < totalTracks; r++) {
        if (data[r].status === "SUBMITTED") {
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
    const result = await matchup(totalTracks, trackIdArray, trackIdToUsedPicksMap, trackStateMap, state.submissionOpen && !state.buyback?.pickBlocked, currentWeek, state.buyback?.pickBlocked === true, state.leagueSeason.year, state.leagueSeason.schedulePhase);
    if (result === "empty") {
      showMatchupEmpty(`No matchups are available for Week ${currentWeek}.`);
      return;
    }
    showMatchupReady();
  } catch (error) {
    browserLogger.error("Unable to load matchup page", error);
    showMatchupError(() => getTrackNumber());
  }
}

async function getRecords(seasonYear, currentWeek, root = document, seasonType = "regular") {
  try {
    const response = await fetchNflSchedule(seasonYear, currentWeek, globalThis.fetch, seasonType);
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

    let recordHTML = root.querySelectorAll(".record");

    for (let i = 0; i < recordHTML.length; i++) {
      let teamName = recordHTML[i].previousSibling.textContent;
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
    throw error;
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

async function matchup(totalTracks, trackIds, usedPicksMap, trackStateMap, submissionOpen, currentWeek, buybackBlocked = false, seasonYear, schedulePhase = "REGULAR") {
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
    throw error;
  }

  let containerNumber = totalTracks;
  const container = document.getElementById("gameMatchups");
  const actions = document.getElementById("trackActions");
  const stagingContainer = document.createElement("section");

  if (!container || !actions || !document.getElementById("logoutBtn")) {
    throw new Error("Required matchup page element is missing");
  }

  container.innerHTML = "";

  const seasonType = schedulePhase === "PRESEASON" ? "preseason" : "regular";
  return new Promise((resolve, reject) => fetchNflSchedule(seasonYear, currentWeek, globalThis.fetch, seasonType)
    .then(function (response) {
      if (response.ok) {
        response.json().then(async function (data) {
          let headerHelp = document.getElementsByTagName("header")[0];
          let currentWeekDiv = document.createElement("div");
          currentWeekDiv.id = "matchupWeek";
          currentWeekDiv.hidden = true;
          let currentWeekH1 = document.createElement("h1");
          currentWeekH1.innerHTML = `Week ${currentWeek}`;
          currentWeekDiv.appendChild(currentWeekH1);

          const thisWeeksGames = Object.values(data.content?.schedule || {}).flatMap((day) => day.games || []).map((game) => {
            const competitors = game.competitions?.[0]?.competitors || [];
            return {
              RoundNumber: currentWeek,
              HomeTeam: competitors.find((team) => team.homeAway === "home")?.team?.displayName,
              AwayTeam: competitors.find((team) => team.homeAway === "away")?.team?.displayName,
              DateUtc: game.date,
            };
          }).filter((game) => game.HomeTeam && game.AwayTeam);

          if (thisWeeksGames.length === 0) {
            resolve("empty");
            return;
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
            trackDropdown.dataset.stateVersion = trackStateMap[trackIds[i]].stateVersion;

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
            const committedTrack = trackStateMap[trackIds[i]]?.status === "SUBMITTED";
            if (committedTrack) {
              hiddenInput.value = `${trackIds[i]},${trackStateMap[trackIds[i]].committedTeamName}`;
              trackLabel.innerText = `TRACK ${i + 1}: ${trackStateMap[trackIds[i]].committedTeamName} (submitted)`;
            }

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
              const gameStarted = new Date(thisWeeksGames[l].DateUtc) <= new Date();
              firstTeamButton.disabled = committedTrack || buybackBlocked || gameStarted;
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
              secondTeamButton.disabled = committedTrack || buybackBlocked || gameStarted;
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
            stagingContainer.appendChild(trackDropdown);
          }

          const submitBtn = document.createElement("button");
          submitBtn.id = "submitPicksBtn";
          submitBtn.className = "btn btn-primary";
          submitBtn.innerText = buybackBlocked ? "Resolve buyback decision before picking" : submissionOpen ? "Submit Picks" : "Pick submission is closed";
          submitBtn.disabled = !submissionOpen;
          submitBtn.addEventListener("click", handleSubmitPicks);

          if (seasonYear) {
            await getRecords(seasonYear, currentWeek, stagingContainer, seasonType);
          } else {
            throw new Error("Unable to determine the League Season year");
          }
          await Promise.all([...stagingContainer.querySelectorAll("img.teamLogos")].map((image) => {
            if (image.complete) {
              return image.naturalWidth > 0
                ? Promise.resolve()
                : Promise.reject(new Error("Unable to load Team logo"));
            }
            return new Promise((imageResolve, imageReject) => {
              image.addEventListener("load", imageResolve, { once: true });
              image.addEventListener("error", () => imageReject(new Error("Unable to load Team logo")), { once: true });
            });
          }));
          container.replaceChildren(...stagingContainer.children);
          headerHelp.appendChild(currentWeekDiv);
          actions.insertBefore(submitBtn, document.getElementById("logoutBtn"));
          resolve("ready");
        }).catch(reject);
      } else {
        reject(new Error("Unable to load Fixture schedule"));
      }
    })
    .catch(function (error) {
      reject(error);
    }));
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
