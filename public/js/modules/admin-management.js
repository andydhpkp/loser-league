import { nflTeams } from "../data/nfl-teams.js";
import { browserLogger } from "../logger.js";

let i;
let j;

function getTeamNames(names) {
  return names.teamName;
}

export function formatUserWinHistory(userRecord = []) {
  const wins = (Array.isArray(userRecord) ? userRecord : []).filter(
    (record) => record.won
  );
  if (wins.length === 0) {
    return "No wins recorded";
  }

  return wins
    .map(
      (record) =>
        `${record.year} ${record.won_with_tie ? "tied" : "solo"}`
    )
    .join(", ");
}

function createWinControls(user) {
  const section = document.createElement("section");
  section.className = "admin-win-controls border-top mt-3 pt-3";

  const heading = document.createElement("h6");
  heading.innerText = "League Season win";

  const history = document.createElement("p");
  history.innerText = `Win history: ${formatUserWinHistory(user.user_record)}`;

  const crownType = document.createElement("p");
  crownType.innerText = `Crown type: ${user.crown_type || "none"}`;

  const yearLabel = document.createElement("label");
  yearLabel.setAttribute("for", `win-year-${user.id}`);
  yearLabel.className = "form-label";
  yearLabel.innerText = "League Season year";

  const yearInput = document.createElement("input");
  yearInput.setAttribute("id", `win-year-${user.id}`);
  yearInput.setAttribute("type", "text");
  yearInput.setAttribute("inputmode", "numeric");
  yearInput.setAttribute("pattern", "[0-9]{4}");
  yearInput.setAttribute("maxlength", "4");
  yearInput.setAttribute("required", "");
  yearInput.className = "form-control mb-2";

  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  const submitWin = async (wonWithTie) => {
    status.innerText = "";
    try {
      const result = await addUserWin({
        userId: user.id,
        displayName: `${user.first_name} ${user.last_name}`,
        // @ts-ignore
        year: yearInput.value,
        wonWithTie,
      });
      if (!result) {
        return;
      }

      user.user_record = result.user_record;
      user.crown_type = result.crown_type;
      history.innerText = `Win history: ${formatUserWinHistory(
        result.user_record
      )}`;
      crownType.innerText = `Crown type: ${result.crown_type || "none"}`;
      // @ts-ignore
      yearInput.value = "";
      status.innerText = "Win recorded";
    } catch (error) {
      status.innerText =
        error.message === "Enter a four-digit League Season year"
          ? error.message
          : "Unable to record win. Please try again.";
    }
  };

  const soloButton = document.createElement("button");
  soloButton.setAttribute("type", "button");
  soloButton.className = "btn btn-primary me-2";
  soloButton.innerText = "Add solo win";
  soloButton.addEventListener("click", () => submitWin(false));

  const tiedButton = document.createElement("button");
  tiedButton.setAttribute("type", "button");
  tiedButton.className = "btn btn-primary";
  tiedButton.innerText = "Add tied win";
  tiedButton.addEventListener("click", () => submitWin(true));

  section.appendChild(heading);
  section.appendChild(history);
  section.appendChild(crownType);
  section.appendChild(yearLabel);
  section.appendChild(yearInput);
  section.appendChild(soloButton);
  section.appendChild(tiedButton);
  section.appendChild(status);
  return section;
}

export async function displayUsers() {
  fetch("/api/users").then(function (response) {
    if (response.ok) {
      response.json().then(function (data) {
        let adminViewUserDiv = document.getElementById("adminUsers");

        // Call the function to create the statistics modal, passing the user data
        createStatisticsModal(adminViewUserDiv, data);

        // Continue with the display of users
        let viewHelper = document.getElementById("andrew");
        browserLogger.debug(viewHelper);
        browserLogger.debug(data);

        // @ts-ignore
        for (i = 0; i < data.length; i++) {
          let hiddenUserId = document.createElement("hidden");
          let trackAmountDiv = document.createElement("div");
          let usersNameDiv = document.createElement("div");
          let trackAmountInput = document.createElement("input");
          let userNameAnchor = document.createElement("a");

          let userModal = document.createElement("div");
          userModal.setAttribute("class", "modal fade");
          // @ts-ignore
          userModal.setAttribute("id", `modal-${data[i].id}`);
          userModal.setAttribute("tabindex", "-1");
          userModal.setAttribute("aria-labelledby", "exampleModalLabel");
          userModal.setAttribute("aria-hidden", "true");

          let userModalCentered = document.createElement("div");
          userModalCentered.setAttribute(
            "class",
            "modal-dialog modal-dialog-centered"
          );

          let userModalContent = document.createElement("div");
          userModalContent.setAttribute("class", "modal-content");

          let userModalHeader = document.createElement("div");
          userModalHeader.setAttribute("class", "modal-header");

          let userModalTitle = document.createElement("h5");
          userModalTitle.setAttribute("class", "modal-title");
          userModalTitle.setAttribute("id", "name");
          // @ts-ignore
          userModalTitle.innerText = `${data[i].first_name}`;

          let userModalHeaderClose = document.createElement("button");
          userModalHeaderClose.setAttribute("type", "button");
          userModalHeaderClose.setAttribute("class", "btn-close");
          userModalHeaderClose.setAttribute("data-bs-dismiss", "modal");
          userModalHeaderClose.setAttribute("aria-label", "Close");

          userModalHeader.appendChild(userModalTitle);
          userModalHeader.appendChild(userModalHeaderClose);

          userModalContent.appendChild(userModalHeader);

          let userModalBody = document.createElement("div");
          userModalBody.setAttribute("class", "modal-body");

          let userModalBodymb = document.createElement("div");
          userModalBodymb.setAttribute("class", "mb-3");

          let form = document.createElement("form");

          let deleteFormDiv = document.createElement("div");
          deleteFormDiv.setAttribute("id", "deleteForm");

          // @ts-ignore
          let individualTrackNumber = data[i].tracks;
          // @ts-ignore
          for (j = 0; j < individualTrackNumber.length; j++) {
            let input = document.createElement("input");
            let label = document.createElement("label");
            let br = document.createElement("br");
            input.setAttribute("type", "checkbox");
            // @ts-ignore
            input.setAttribute("id", `${individualTrackNumber[j].id}`);
            input.setAttribute("name", "track");
            input.setAttribute("value", "delete");

            // @ts-ignore
            label.setAttribute("for", `${individualTrackNumber[j].id}`);
            // @ts-ignore
            label.innerText = ` Track ${j + 1}`;

            deleteFormDiv.appendChild(input);
            deleteFormDiv.appendChild(label);
            deleteFormDiv.appendChild(br);
          }

          let userNameDiv = document.createElement("div");

          let nameInput = document.createElement("input");
          nameInput.setAttribute("type", "checkbox");
          // @ts-ignore
          nameInput.setAttribute("id", `${data[i].username}`);
          nameInput.setAttribute("name", "user");
          nameInput.setAttribute("value", "delete");

          let nameLabel = document.createElement("label");
          nameLabel.setAttribute("for", "userDelete");
          // @ts-ignore
          nameLabel.innerText = ` Delete User: ${data[i].first_name}`;

          userNameDiv.appendChild(nameInput);
          userNameDiv.appendChild(nameLabel);

          let modalFooterDiv = document.createElement("div");
          modalFooterDiv.setAttribute("class", "modal-footer");

          let closeBtn = document.createElement("button");
          closeBtn.setAttribute("type", "button");
          closeBtn.setAttribute("class", "btn btn-secondary");
          closeBtn.setAttribute("data-bs-dismiss", "modal");
          closeBtn.innerText = "Close";

          let deleteBtn = document.createElement("button");
          deleteBtn.setAttribute("type", "button");
          deleteBtn.setAttribute("class", "btn btn-primary");
          deleteBtn.addEventListener("click", deleteTracksAdmin);
          deleteBtn.innerText = "Delete Selected";

          modalFooterDiv.appendChild(closeBtn);
          modalFooterDiv.appendChild(deleteBtn);

          form.appendChild(deleteFormDiv);
          form.appendChild(userNameDiv);
          form.appendChild(modalFooterDiv);

          userModalBodymb.appendChild(form);

          userModalBody.appendChild(userModalBodymb);
          userModalBody.appendChild(createWinControls(data[i]));

          userModalContent.appendChild(userModalBody);

          userModalCentered.appendChild(userModalContent);

          userModal.appendChild(userModalCentered);

          userNameAnchor.setAttribute("data-bs-toggle", "modal");
          // @ts-ignore
          userNameAnchor.setAttribute("data-bs-target", `#modal-${data[i].id}`);
          userNameAnchor.setAttribute("href", "#");
          trackAmountInput.setAttribute("type", "text");
          trackAmountInput.setAttribute("class", "trackAmounts");
          trackAmountInput.setAttribute("placeholder", "Number of Tracks");
          let individualUserDiv = document.createElement("div");
          individualUserDiv.className = "adminUsersView";
          // @ts-ignore
          userNameAnchor.innerHTML = data[i].first_name;
          // @ts-ignore
          hiddenUserId.innerText = data[i].id;
          individualUserDiv.appendChild(userNameAnchor);
          trackAmountDiv.appendChild(trackAmountInput);
          individualUserDiv.appendChild(usersNameDiv);
          individualUserDiv.appendChild(trackAmountDiv);
          individualUserDiv.appendChild(hiddenUserId);
          // @ts-ignore
          adminViewUserDiv.appendChild(individualUserDiv);
          // @ts-ignore
          adminViewUserDiv.appendChild(userModal);
        }

        let trackSubmitBtn = document.createElement("button");
        trackSubmitBtn.setAttribute("class", "btn btn-primary");
        trackSubmitBtn.addEventListener("click", submitTrackNumberHandler);
        trackSubmitBtn.style.margin = "24px";
        trackSubmitBtn.innerText = "Submit Tracks";
        // @ts-ignore
        adminViewUserDiv.appendChild(trackSubmitBtn);
      });
    } else {
      alert("Sorry, could not connect to database");
    }
  });
}

// Function to create statistics button and modal
function createStatisticsModal(adminViewUserDiv, data) {
  // Create "View Weekly Statistics" button and modal
  let viewStatisticsButton = document.createElement("button");
  viewStatisticsButton.setAttribute("class", "btn btn-info mb-3");
  viewStatisticsButton.setAttribute("data-bs-toggle", "modal");
  viewStatisticsButton.setAttribute("data-bs-target", "#weeklyStatisticsModal");
  viewStatisticsButton.innerText = "View Weekly Statistics";

  // Append the button above the user data
  adminViewUserDiv.appendChild(viewStatisticsButton);

  // Create the modal structure for "Weekly Statistics"
  let statisticsModal = document.createElement("div");
  statisticsModal.setAttribute("class", "modal fade");
  statisticsModal.setAttribute("id", "weeklyStatisticsModal");
  statisticsModal.setAttribute("tabindex", "-1");
  statisticsModal.setAttribute("aria-labelledby", "weeklyStatisticsModalLabel");
  statisticsModal.setAttribute("aria-hidden", "true");

  let statisticsModalDialog = document.createElement("div");
  // Make the modal large with 'modal-lg' class to stretch it
  statisticsModalDialog.setAttribute("class", "modal-dialog modal-lg");

  let statisticsModalContent = document.createElement("div");
  statisticsModalContent.setAttribute("class", "modal-content");

  // Modal header
  let statisticsModalHeader = document.createElement("div");
  statisticsModalHeader.setAttribute("class", "modal-header");

  let statisticsModalTitle = document.createElement("h5");
  statisticsModalTitle.setAttribute("class", "modal-title");
  statisticsModalTitle.setAttribute("id", "weeklyStatisticsModalLabel");
  statisticsModalTitle.innerText = "Weekly Statistics";

  let statisticsModalClose = document.createElement("button");
  statisticsModalClose.setAttribute("type", "button");
  statisticsModalClose.setAttribute("class", "btn-close");
  statisticsModalClose.setAttribute("data-bs-dismiss", "modal");
  statisticsModalClose.setAttribute("aria-label", "Close");

  statisticsModalHeader.appendChild(statisticsModalTitle);
  statisticsModalHeader.appendChild(statisticsModalClose);

  // Create a table to display statistics
  let statisticsTable = document.createElement("table");
  statisticsTable.setAttribute("class", "table");
  statisticsTable.style.width = "100%"; // Full width table for better alignment

  // Find the most and least popular pick and calculate the percentage
  let currentPicks = [];
  data.forEach((user) => {
    user.tracks.forEach((track) => {
      if (track.current_pick) {
        currentPicks.push(track.current_pick);
      }
    });
  });

  // Count occurrences of each pick
  let pickCount = {};
  currentPicks.forEach((pick) => {
    pickCount[pick] = (pickCount[pick] || 0) + 1;
  });

  // Find the highest and lowest counts
  let maxCount = Math.max(...Object.values(pickCount));
  let minCount = Math.min(...Object.values(pickCount));

  // Find all picks that are tied for the most and least popular
  let mostPopularPicks = Object.keys(pickCount).filter(
    (pick) => pickCount[pick] === maxCount
  );
  let leastPopularPicks = Object.keys(pickCount).filter(
    (pick) => pickCount[pick] === minCount
  );

  // Calculate the percentage of tracks using the most popular and least popular picks
  let totalTracks = currentPicks.length;
  let mostPopularPercentage = ((maxCount / totalTracks) * 100).toFixed(2); // Percentage for most popular
  let leastPopularPercentage = ((minCount / totalTracks) * 100).toFixed(2); // Percentage for least popular

  // Create a row for the "Most Popular Pick"
  let popularPickRow = document.createElement("tr");

  let titleCell = document.createElement("td");
  titleCell.innerText = "Most Popular Pick:";
  titleCell.style.whiteSpace = "nowrap"; // Prevent wrapping
  titleCell.style.fontWeight = "bold"; // Make title bold
  titleCell.style.textAlign = "left"; // Left-align the title

  let resultCell = document.createElement("td");
  resultCell.innerText = `${mostPopularPicks.join(
    ", "
  )} (${mostPopularPercentage}% of total tracks)`;
  resultCell.style.textAlign = "center"; // Center-align the statistic value

  popularPickRow.appendChild(titleCell);
  popularPickRow.appendChild(resultCell);

  // Append the "Most Popular Pick" row to the table
  statisticsTable.appendChild(popularPickRow);

  // Create a row for the "Least Popular Pick"
  let leastPopularPickRow = document.createElement("tr");

  let leastTitleCell = document.createElement("td");
  leastTitleCell.innerText = "Least Popular Pick:";
  leastTitleCell.style.whiteSpace = "nowrap"; // Prevent wrapping
  leastTitleCell.style.fontWeight = "bold"; // Make title bold
  leastTitleCell.style.textAlign = "left"; // Left-align the title

  let leastResultCell = document.createElement("td");
  leastResultCell.innerText = `${leastPopularPicks.join(
    ", "
  )} (${leastPopularPercentage}% of total tracks)`;
  leastResultCell.style.textAlign = "center"; // Center-align the statistic value

  leastPopularPickRow.appendChild(leastTitleCell);
  leastPopularPickRow.appendChild(leastResultCell);

  // Append the "Least Popular Pick" row to the table
  statisticsTable.appendChild(leastPopularPickRow);

  // Calculate Players Eliminated and Players Left
  let playersEliminated = 0;
  let playersLeft = 0;

  data.forEach((user) => {
    const allTracksEliminated = user.tracks.every(
      (track) => track.wrong_pick !== null
    );
    if (allTracksEliminated) {
      playersEliminated++;
    } else {
      playersLeft++;
    }
  });

  // Create a row for "Players Eliminated"
  let eliminatedRow = document.createElement("tr");

  let eliminatedTitleCell = document.createElement("td");
  eliminatedTitleCell.innerText = "Players Eliminated:";
  eliminatedTitleCell.style.whiteSpace = "nowrap"; // Prevent wrapping
  eliminatedTitleCell.style.fontWeight = "bold"; // Make title bold
  eliminatedTitleCell.style.textAlign = "left"; // Left-align the title

  let eliminatedResultCell = document.createElement("td");
  eliminatedResultCell.innerText = playersEliminated;
  eliminatedResultCell.style.textAlign = "center"; // Center-align the statistic value

  eliminatedRow.appendChild(eliminatedTitleCell);
  eliminatedRow.appendChild(eliminatedResultCell);

  // Append the "Players Eliminated" row to the table
  statisticsTable.appendChild(eliminatedRow);

  // Create a row for "Players Left"
  let playersLeftRow = document.createElement("tr");

  let playersLeftTitleCell = document.createElement("td");
  playersLeftTitleCell.innerText = "Players Left:";
  playersLeftTitleCell.style.whiteSpace = "nowrap"; // Prevent wrapping
  playersLeftTitleCell.style.fontWeight = "bold"; // Make title bold
  playersLeftTitleCell.style.textAlign = "left"; // Left-align the title

  let playersLeftResultCell = document.createElement("td");
  playersLeftResultCell.innerText = playersLeft;
  playersLeftResultCell.style.textAlign = "center"; // Center-align the statistic value

  playersLeftRow.appendChild(playersLeftTitleCell);
  playersLeftRow.appendChild(playersLeftResultCell);

  // Append the "Players Left" row to the table
  statisticsTable.appendChild(playersLeftRow);

  // Calculate Tracks Left (tracks with null or empty wrong_pick)
  let tracksLeft = 0;
  let userTrackCounts = [];

  // Collect information for the most and least tracks
  data.forEach((user) => {
    const activeTracks = user.tracks.filter(
      (track) => !track.wrong_pick
    ).length;
    userTrackCounts.push({
      name: user.first_name + " " + user.last_name,
      activeTracks,
    });
    tracksLeft += activeTracks;
  });

  // Create a row for "Tracks Left"
  let tracksLeftRow = document.createElement("tr");

  let tracksLeftTitleCell = document.createElement("td");
  tracksLeftTitleCell.innerText = "Tracks Left:";
  tracksLeftTitleCell.style.whiteSpace = "nowrap"; // Prevent wrapping
  tracksLeftTitleCell.style.fontWeight = "bold"; // Make title bold
  tracksLeftTitleCell.style.textAlign = "left"; // Left-align the title

  let tracksLeftResultCell = document.createElement("td");
  tracksLeftResultCell.innerText = tracksLeft;
  tracksLeftResultCell.style.textAlign = "center"; // Center-align the statistic value

  tracksLeftRow.appendChild(tracksLeftTitleCell);
  tracksLeftRow.appendChild(tracksLeftResultCell);

  // Append the "Tracks Left" row to the table
  statisticsTable.appendChild(tracksLeftRow);

  // Calculate player with most and least tracks
  const maxTracks = Math.max(...userTrackCounts.map((u) => u.activeTracks));
  const minTracks = Math.min(...userTrackCounts.map((u) => u.activeTracks));

  const playersWithMostTracks = userTrackCounts
    .filter((u) => u.activeTracks === maxTracks)
    .map((u) => u.name)
    .join(", ");

  const playersWithLeastTracks = userTrackCounts
    .filter((u) => u.activeTracks === minTracks)
    .map((u) => u.name)
    .join(", ");

  // Create a row for "Player with Most Tracks"
  let mostTracksRow = document.createElement("tr");

  let mostTracksTitleCell = document.createElement("td");
  mostTracksTitleCell.innerText = "Player with Most Tracks:";
  mostTracksTitleCell.style.whiteSpace = "nowrap"; // Prevent wrapping
  mostTracksTitleCell.style.fontWeight = "bold"; // Make title bold
  mostTracksTitleCell.style.textAlign = "left"; // Left-align the title

  let mostTracksResultCell = document.createElement("td");
  mostTracksResultCell.innerText = `${playersWithMostTracks} (${maxTracks} tracks)`;
  mostTracksResultCell.style.textAlign = "center"; // Center-align the statistic value

  mostTracksRow.appendChild(mostTracksTitleCell);
  mostTracksRow.appendChild(mostTracksResultCell);

  // Append the "Player with Most Tracks" row to the table
  statisticsTable.appendChild(mostTracksRow);

  // Create a row for "Player with Least Tracks"
  let leastTracksRow = document.createElement("tr");

  let leastTracksTitleCell = document.createElement("td");
  leastTracksTitleCell.innerText = "Player with Least Tracks:";
  leastTracksTitleCell.style.whiteSpace = "nowrap"; // Prevent wrapping
  leastTracksTitleCell.style.fontWeight = "bold"; // Make title bold
  leastTracksTitleCell.style.textAlign = "left"; // Left-align the title

  let leastTracksResultCell = document.createElement("td");
  leastTracksResultCell.innerText = `${playersWithLeastTracks} (${minTracks} tracks)`;
  leastTracksResultCell.style.textAlign = "center"; // Center-align the statistic value

  leastTracksRow.appendChild(leastTracksTitleCell);
  leastTracksRow.appendChild(leastTracksResultCell);

  // Append the "Player with Least Tracks" row to the table
  statisticsTable.appendChild(leastTracksRow);

  // Modal body where the table will be placed
  let statisticsModalBody = document.createElement("div");
  statisticsModalBody.setAttribute("class", "modal-body");
  statisticsModalBody.appendChild(statisticsTable); // Add the table to the modal body

  // Append header and body to modal content
  statisticsModalContent.appendChild(statisticsModalHeader);
  statisticsModalContent.appendChild(statisticsModalBody);

  // Modal footer
  let statisticsModalFooter = document.createElement("div");
  statisticsModalFooter.setAttribute("class", "modal-footer");

  let statisticsCloseButton = document.createElement("button");
  statisticsCloseButton.setAttribute("type", "button");
  statisticsCloseButton.setAttribute("class", "btn btn-secondary");
  statisticsCloseButton.setAttribute("data-bs-dismiss", "modal");
  statisticsCloseButton.innerText = "Close";

  let reloadOddsButton = document.createElement("button");
  reloadOddsButton.setAttribute("type", "button");
  reloadOddsButton.setAttribute("class", "btn btn-primary");
  reloadOddsButton.innerText = "Reload Game Odds";

  // Event listener for the Reload Odds button
  reloadOddsButton.addEventListener("click", function () {
    // Pass full user data with tracks into the getGameOdds function
    getGameOdds(data); // Calls your odds-fetching function with user and track data
  });

  // Append buttons to the footer
  statisticsModalFooter.appendChild(statisticsCloseButton);
  statisticsModalFooter.appendChild(reloadOddsButton);

  // Append footer to modal content
  statisticsModalContent.appendChild(statisticsModalFooter);

  // Append modal content to modal dialog
  statisticsModalDialog.appendChild(statisticsModalContent);

  // Append modal dialog to modal
  statisticsModal.appendChild(statisticsModalDialog);

  // Append the modal to the main div
  adminViewUserDiv.appendChild(statisticsModal);
}

async function getGameOdds(users) {
  try {
    const response = await fetch("/api/proxy/nfl-odds");

    if (!response.ok) throw new Error("Failed to fetch odds");

    const oddsData = await response.json();

    // Flatten all current picks to get picks with associated users
    let currentPicks = [];
    users.forEach((user) => {
      user.tracks.forEach((track) => {
        if (track.current_pick) {
          currentPicks.push({
            pick: track.current_pick,
            user: `${user.first_name} ${user.last_name}`, // Associate the pick with the user's name
          });
        }
      });
    });

    // To store the first appearance of each team
    let teamsSeen = new Set();

    // Track the riskiest pick and who made it
    let riskiestPick = null;
    let riskiestPoint = null;
    let riskiestPickers = [];

    // Loop through each game's odds
    oddsData.forEach((game) => {
      if (game.bookmakers && game.bookmakers.length > 0) {
        const bookmaker = game.bookmakers[0];
        if (bookmaker.markets && bookmaker.markets.length > 0) {
          const market = bookmaker.markets[0];
          market.outcomes.forEach((outcome) => {
            currentPicks.forEach(({ pick, user }) => {
              if (!teamsSeen.has(outcome.name) && pick === outcome.name) {
                // Mark the team as seen
                teamsSeen.add(outcome.name);

                // Logic to determine the riskiest pick
                if (riskiestPoint === null) {
                  // Initialize with the first point
                  riskiestPick = outcome.name;
                  riskiestPoint = outcome.point;
                  riskiestPickers = [user];
                } else {
                  // Compare spreads
                  const isCurrentRiskier =
                    (outcome.point < 0 && outcome.point < riskiestPoint) || // More negative spreads are riskier
                    (outcome.point > 0 &&
                      riskiestPoint > 0 &&
                      outcome.point < riskiestPoint); // Smaller positive spreads are riskier

                  if (isCurrentRiskier) {
                    riskiestPick = outcome.name;
                    riskiestPoint = outcome.point;
                    riskiestPickers = [user]; // Reset with the current user
                  } else if (outcome.point === riskiestPoint) {
                    // If they have the same spread, add the user
                    riskiestPickers.push(user);
                  }
                }
              }
            });
          });
        }
      }
    });

    // Update the modal to show the riskiest pick and users who made it
    if (riskiestPick !== null) {
      let riskiestPickRow = document.getElementById("riskiest-pick-row");

      if (!riskiestPickRow) {
        riskiestPickRow = document.createElement("tr");
        riskiestPickRow.setAttribute("id", "riskiest-pick-row");

        let titleCell = document.createElement("td");
        titleCell.innerText = "Riskiest Pick:";
        titleCell.style.whiteSpace = "nowrap";
        titleCell.style.fontWeight = "bold";
        titleCell.style.textAlign = "left";

        let resultCell = document.createElement("td");
        resultCell.setAttribute("id", "riskiest-pick-result");
        resultCell.style.textAlign = "center";

        riskiestPickRow.appendChild(titleCell);
        riskiestPickRow.appendChild(resultCell);

        const statisticsTable = document.querySelector(".table");
        statisticsTable.appendChild(riskiestPickRow);
      }

      const resultCell = document.getElementById("riskiest-pick-result");
      resultCell.innerText = `${riskiestPickers.join(
        ", "
      )}: ${riskiestPick} (Spread: ${riskiestPoint})`;
    } else {
      browserLogger.debug("No valid pick found for comparison.");
    }
  } catch (error) {
    browserLogger.error("Error fetching or processing odds data: ", error);
  }
}

function submitTrackNumberHandler() {
  let idGetter = document.getElementsByClassName("adminUsersView");
  let trackGetter = document.getElementsByClassName("trackAmounts");
  browserLogger.debug("IDGETTER");
  browserLogger.debug(idGetter);
  browserLogger.debug(trackGetter);
  let postTrackHelp = [];
  // @ts-ignore
  for (i = 0; i < idGetter.length; i++) {
    // @ts-ignore
    let user_id = idGetter[i].children[3].innerText;
    // @ts-ignore
    let track_number = trackGetter[i].value.trim();
    postTrackHelp.push({
      userId: parseInt(user_id),
      trackNumber: parseInt(track_number),
    });
  }
  // @ts-ignore
  for (i = 0; i < postTrackHelp.length; i++) {
    browserLogger.debug(postTrackHelp);
    // @ts-ignore
    for (j = 0; j < postTrackHelp[i].trackNumber; j++) {
      // @ts-ignore
      createTrack(postTrackHelp[i].userId);
    }
  }
}

export async function loginAdmin(password, fetchImpl = fetch) {
  const response = await fetchImpl("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    throw new Error("Incorrect admin password");
  }
}

export async function logoutAdmin(fetchImpl = fetch) {
  const response = await fetchImpl("/api/admin/logout", { method: "POST" });
  if (!response.ok) {
    throw new Error("Admin logout failed");
  }
}

export async function addUserWin(
  { userId, displayName, year, wonWithTie },
  { confirmImpl = confirm, fetchImpl = fetch } = {}
) {
  const yearText = String(year);
  const normalizedYear = Number(yearText);
  if (
    !/^\d{4}$/.test(yearText) ||
    !Number.isInteger(normalizedYear) ||
    normalizedYear < 1000 ||
    normalizedYear > 9999
  ) {
    throw new Error("Enter a four-digit League Season year");
  }

  const winType = wonWithTie ? "tied" : "solo";
  const confirmed = confirmImpl(
    `Add a ${winType} win for ${displayName} for the ${yearText} League Season?`
  );
  if (!confirmed) {
    return null;
  }

  const response = await fetchImpl(`/api/users/${userId}/add-win`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      year: normalizedYear,
      won_with_tie: wonWithTie,
    }),
  });
  if (!response.ok) {
    throw new Error("Unable to add win");
  }
  return response.json();
}

export async function adminHandler() {
  // @ts-ignore
  const adminPasswordInput = document.getElementById("adminPasswordInput");
  // @ts-ignore
  const adminPassword = adminPasswordInput?.value ?? "";

  try {
    await loginAdmin(adminPassword);
    // @ts-ignore
    adminPasswordInput.value = "";
    location.href = "../admin.html";
  } catch (_error) {
    alert("Incorrect admin password");
  }
}

async function deleteTracksAdmin() {
  let altFormResults = document.getElementsByName("track");
  let deleteUserForm = document.getElementsByName("user");

  var checkedTracks = 0;
  // @ts-ignore
  for (i = 0; i < altFormResults.length; i++) {
    // @ts-ignore
    if (altFormResults[i].checked) {
      checkedTracks++;
      // @ts-ignore
      let deleteId = parseInt(altFormResults[i].id);
      let response = await fetch(`api/tracks/${deleteId}`, {
        method: "delete",
      });
      if (response.ok) {
        browserLogger.debug("it worked");
      } else {
        alert(response.statusText);
      }
    }
  }

  // @ts-ignore
  for (j = 0; j < deleteUserForm.length; j++) {
    // @ts-ignore
    if (deleteUserForm[j].checked) {
      // @ts-ignore
      let deleteUsername = deleteUserForm[j].id;
      let response = await fetch(`api/users/username/${deleteUsername}`, {
        method: "delete",
      });
      if (response.ok) {
        browserLogger.debug("it worked");
      } else {
        alert(response.statusText);
      }
    }
  }

  location.reload();
}

async function createTrack(user_id) {
  // @ts-ignore
  let available_picks = nflTeams.map(getTeamNames);
  let used_picks = [];
  let current_pick = "";

  const response = await fetch("/api/tracks", {
    method: "post",
    body: JSON.stringify({
      available_picks,
      used_picks,
      current_pick,
      user_id,
    }),
    headers: { "Content-Type": "application/json" },
  });
  if (response.ok) {
    browserLogger.debug("CREATED TRACK");
  } else {
    alert(response.statusText);
  }
}
