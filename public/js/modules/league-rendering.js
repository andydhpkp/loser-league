import { finalScores } from "../teams.js";
import { getCrownInfo } from "../utilityFunctions.js";
import { browserLogger } from "../logger.js";
import { fetchNflTeams } from "./nfl-data.js";
import { sortUsersByTracksLeft } from "./league-stats.js";

let i;
let p;
let t;
let x;
let y;

// Updated leagueUserTableHandler function
export async function leagueUserTableHandler() {
  let headerHelp = document.getElementsByTagName("header")[0];
  browserLogger.debug(headerHelp);
  let currentWeekDiv = document.createElement("div");
  let currentWeekH1 = document.createElement("h1");
  let currentWeek;
  currentWeekDiv.appendChild(currentWeekH1);
  headerHelp.appendChild(currentWeekDiv);

  fetch("/api/user/league/view").then(function (response) {
    if (response.ok) {
      response.json().then(function (leagueView) {
        const currentWeekNumber = Number(leagueView.leagueSeason.week);
        currentWeek = String(currentWeekNumber);
        currentWeekH1.innerText = `Week ${currentWeek}`;
        const data = leagueView.users.map((user) => ({
          id: user.id,
          first_name: user.firstName,
          last_name: user.lastName,
          crown_type: user.crownType,
          tracks: user.tracks.map((track) => ({
            id: track.id,
            wrong_pick: null,
            current_pick: track.currentPick.status === "VISIBLE" ? track.currentPick.teamName : null,
            used_picks: user.picksSubmitted ? Array(currentWeekNumber).fill("submitted") : [],
          })),
        }));
        browserLogger.debug("Original data:", data);

        // Sort users by tracks left using our helper function
        const sortedData = sortUsersByTracksLeft(data);
        browserLogger.debug("Sorted data:", sortedData);

        let largestPickLength = 0;
        //find the picks length
        // @ts-ignore
        for (p = 0; p < sortedData.length; p++) {
          let validTracks = sortedData[p].tracks.filter(
            (track) => !track.wrong_pick
          );
          let pickTester = validTracks.length;

          if (pickTester >= largestPickLength) {
            largestPickLength = pickTester;
          }
        }

        let viewUsersTable = document.getElementById("leagueMain");

        let mainTable = document.createElement("table");
        mainTable.className = "table table-striped";
        let tHead = document.createElement("thead");
        let trHead = document.createElement("tr");

        // First column for rank number
        let rankScope = document.createElement("th");
        rankScope.setAttribute("scope", "col");

        // Second column for crown
        let crownScope = document.createElement("th");
        crownScope.setAttribute("scope", "col");
        crownScope.className = "crown-column";
        // No title for crown column

        let secondScope = document.createElement("th");
        secondScope.setAttribute("scope", "col");
        secondScope.innerText = "First";

        let thirdScope = document.createElement("th");
        thirdScope.setAttribute("scope", "col");
        thirdScope.innerText = "Last";

        let fourthScope = document.createElement("th");
        fourthScope.setAttribute("scope", "col");
        fourthScope.innerText = "Tracks Left";

        let fifthScope = document.createElement("th");
        fifthScope.setAttribute("scope", "col");
        fifthScope.innerText = "Picks Submitted";

        let sixthScope = document.createElement("th");
        sixthScope.setAttribute("scope", "col");
        // @ts-ignore
        sixthScope.setAttribute("colspan", largestPickLength);
        sixthScope.innerText = "Current Picks";

        trHead.appendChild(rankScope);
        trHead.appendChild(crownScope);
        trHead.appendChild(secondScope);
        trHead.appendChild(thirdScope);
        trHead.appendChild(fourthScope);
        trHead.appendChild(fifthScope);
        trHead.appendChild(sixthScope);
        tHead.appendChild(trHead);
        mainTable.appendChild(tHead);

        browserLogger.debug(mainTable);

        let tBody = document.createElement("tbody");

        // @ts-ignore - Now using sortedData instead of data
        for (i = 0; i < sortedData.length; i++) {
          let eliminated = false;
          let tr = document.createElement("tr");

          // Rank number column
          let thRank = document.createElement("th");
          thRank.setAttribute("scope", "row");
          thRank.innerText = i + 1;
          tr.appendChild(thRank);

          // Crown column
          let tdCrown = document.createElement("td");
          tdCrown.className = "crown-column";
          const crownInfo = getCrownInfo(sortedData[i].crown_type);

          if (crownInfo) {
            let crownImg = document.createElement("img");
            crownImg.classList.add("crown-icon");
            crownImg.src = crownInfo.src;
            crownImg.alt = crownInfo.alt;
            // Remove the title attribute so no tooltip appears
            tdCrown.appendChild(crownImg);
          }
          tr.appendChild(tdCrown);

          let tdFirst = document.createElement("td");
          // @ts-ignore - using sortedData
          tdFirst.innerText = sortedData[i].first_name;
          let tdLast = document.createElement("td");
          // @ts-ignore - using sortedData
          tdLast.innerText = sortedData[i].last_name;
          let tdTracks = document.createElement("td");
          // @ts-ignore - using sortedData
          const wrongPicksCount = sortedData[i].tracks.filter(
            (track) => track.wrong_pick !== null
          ).length;
          tdTracks.innerText = sortedData[i].tracks.length - wrongPicksCount;

          if (tdTracks.innerText === "0") {
            eliminated = true;
          }

          let tdSubmitted = document.createElement("td");
          let submitted = "No";

          // @ts-ignore - using sortedData
          // @ts-ignore
          let trackChecker = parseInt(currentWeek);
          trackChecker++;
          // @ts-ignore - using sortedData
          for (t = 0; t < sortedData[i].tracks.length - wrongPicksCount; t++) {
            // @ts-ignore
            // @ts-ignore
            // @ts-ignore
            //
            const matchingTracksCount = sortedData[i].tracks.filter(
              (track) => track.used_picks.length === parseInt(currentWeek)
            ).length;
            if (
              matchingTracksCount >=
              sortedData[i].tracks.length - wrongPicksCount
            ) {
              submitted = "Yes";
            }
          }

          tdSubmitted.innerText = submitted;

          tr.appendChild(tdFirst);
          tr.appendChild(tdLast);
          tr.appendChild(tdTracks);
          tr.appendChild(tdSubmitted);
          // @ts-ignore
          tr.setAttribute("colspan", largestPickLength);
          if (eliminated === true) {
            tr.className = "eliminated";
          }

          tBody.appendChild(tr);

          // @ts-ignore - using sortedData
          // Filter the tracks first
          let validTracks = sortedData[i].tracks.filter(
            (track) => track.wrong_pick === null
          );

          for (x = 0; x < largestPickLength; x++) {
            try {
              let tdTeamName = document.createElement("td");
              let hiddenTeamName = document.createElement("p");
              let hiddenTrackId = document.createElement("p");
              hiddenTeamName.hidden = true;
              hiddenTrackId.hidden = true;

              // Using validTracks here
              hiddenTrackId.innerText = validTracks[x].id;
              hiddenTeamName.innerText = validTracks[x].current_pick;

              tdTeamName.appendChild(hiddenTeamName);
              tdTeamName.appendChild(hiddenTrackId);
              tdTeamName.className = "teamNames";
              tr.appendChild(tdTeamName);
              tBody.appendChild(tr);
            } catch (err) {
              let tdTeamName = document.createElement("td");
              tr.appendChild(tdTeamName);
              tBody.appendChild(tr);
            }
          }
        }

        mainTable.appendChild(tBody);

        // @ts-ignore
        viewUsersTable.appendChild(mainTable);
        displayTeamLogo();
        // @ts-ignore
        finalScores({ year: leagueView.leagueSeason.year, week: currentWeekNumber });
      });
    } else {
      alert("Sorry, could not connect to database");
    }
  });
}

async function displayTeamLogo() {
  fetchNflTeams().then(function (response) {
    if (response.ok) {
      response.json().then(function (data) {
        let textPicks = document.getElementsByClassName("teamNames");
        // @ts-ignore
        for (x = 0; x < textPicks.length; x++) {
          // @ts-ignore
          for (y = 0; y < data.sports[0].leagues[0].teams.length; y++) {
            // @ts-ignore
            if (
              textPicks[x].children[0].innerText ===
              data.sports[0].leagues[0].teams[y].team.displayName
            ) {
              let logoImg = document.createElement("img");
              logoImg.className = "teamLogos";
              // @ts-ignore
              logoImg.src =
                data.sports[0].leagues[0].teams[y].team.logos[0].href;
              // @ts-ignore
              textPicks[x].appendChild(logoImg);
            }
          }
        }
      });
    } else {
      alert("Could Not Connect");
    }
  });
}
