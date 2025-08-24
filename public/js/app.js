//const match = require("nodemon/lib/monitor/match");

function getTeamNames(names) {
  return names.teamName;
}

async function displayUsers() {
  fetch("/api/users").then(function (response) {
    if (response.ok) {
      response.json().then(function (data) {
        let adminViewUserDiv = document.getElementById("adminUsers");

        // Call the function to create the statistics modal, passing the user data
        createStatisticsModal(adminViewUserDiv, data);

        // Continue with the display of users
        let viewHelper = document.getElementById("andrew");
        console.log(viewHelper);
        console.log(data);

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
          deleteBtn.setAttribute("onclick", "deleteTracksAdmin()");
          deleteBtn.innerText = "Delete Selected";

          modalFooterDiv.appendChild(closeBtn);
          modalFooterDiv.appendChild(deleteBtn);

          form.appendChild(deleteFormDiv);
          form.appendChild(userNameDiv);
          form.appendChild(modalFooterDiv);

          userModalBodymb.appendChild(form);

          userModalBody.appendChild(userModalBodymb);

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
        trackSubmitBtn.setAttribute("onclick", "submitTrackNumberHandler()");
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
    const response = await fetch(
      "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/?apiKey=9935d03409a593557042e410f0de3da0&regions=us&markets=spreads&Format=american&bookmakers=draftkings"
    );

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
      console.log("No valid pick found for comparison.");
    }
  } catch (error) {
    console.error("Error fetching or processing odds data: ", error);
  }
}

function submitTrackNumberHandler() {
  let idGetter = document.getElementsByClassName("adminUsersView");
  let trackGetter = document.getElementsByClassName("trackAmounts");
  console.log("IDGETTER");
  console.log(idGetter);
  console.log(trackGetter);
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
    console.log(postTrackHelp);
    // @ts-ignore
    for (j = 0; j < postTrackHelp[i].trackNumber; j++) {
      // @ts-ignore
      createTrack(postTrackHelp[i].userId);
    }
  }
}

async function getUserId() {
  try {
    const response = await fetch(`/api/users/`);
    if (response.ok) {
      const data = await response.json();
      const loggedInUsername = localStorage.getItem("loggedInUser");
      if (!loggedInUsername) {
        console.error("No logged in username found in local storage.");
        return null;
      }

      const matchedUser = data.find(
        (user) => user.username.toLowerCase() === loggedInUsername.toLowerCase()
      );

      if (matchedUser) {
        const loggedInUserId = matchedUser.id;
        console.log(`User ID found: ${loggedInUserId}`);
        localStorage.setItem("loggedInUserId", loggedInUserId);
        return loggedInUserId;
      } else {
        console.error("No matching user found.");
        return null;
      }
    } else {
      console.error("Failed to fetch users.");
      return null;
    }
  } catch (error) {
    console.error("An error occurred while fetching the user ID:", error);
    return null;
  }
}

async function handleSubmitPicks() {
  let allInputsHaveValue = Array.from(
    document.querySelectorAll(".tempSelection")
  ).every((input) => input.value);

  if (allInputsHaveValue) {
    let updatePromises = []; // Array to hold all the promises

    document.querySelectorAll(".trackContainer").forEach((container) => {
      let tempInput = container.querySelector(".tempSelection");
      if (tempInput) {
        let value = tempInput.value;
        if (value) {
          let splitValue = value.split(",");
          let id = parseInt(splitValue[0], 10);
          let pick = splitValue[1];

          // Assuming updateTrackPick returns a promise
          updatePromises.push(updateTrackPick(id, pick));
        }
      }
    });

    // Wait for all updateTrackPick promises to resolve
    try {
      await Promise.all(updatePromises);
      window.location.replace("../league-page.html");
    } catch (error) {
      console.error("Error updating some tracks:", error);
      alert("There was an error updating your picks. Please try again.");
    }
  } else {
    alert("Please make a selection for each matchup before submitting!");
  }
}

function updateTrackPick(trackId, currentPick) {
  // Create the request payload
  const payload = {
    current_pick: currentPick,
  };

  // Make a PUT request to the server with the track ID and the current pick
  return fetch(`api/tracks/${trackId}`, {
    // Return this fetch promise
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data) {
        console.log("Track updated successfully!", data);
      } else {
        console.error("Error updating track");
        throw new Error("Error updating track"); // Throw an error to be caught in catch() block
      }
    })
    .catch((error) => {
      console.error("There was an error updating the track:", error);
      throw error; // Propagate the error up so that it can be caught in handleSubmitPicks
    });
}

async function makePick(
  available_picks,
  used_picks,
  current_pick,
  user_id,
  putTrackId
) {
  const response = await fetch(`api/tracks/${putTrackId}`, {
    method: "put",
    body: JSON.stringify({
      available_picks,
      used_picks,
      current_pick,
      user_id,
    }),
    headers: { "Content-Type": "application/json" },
  });
  if (response.ok) {
    console.log("updated");
    location.href = "../league-page.html";
  } else {
    alert(response.statusText);
  }
}

function revealLoginPassword() {
  var x = document.getElementById("inputPassword");
  // @ts-ignore
  if (x.type === "password") {
    // @ts-ignore
    x.type = "text";
  } else {
    // @ts-ignore
    x.type = "password";
  }
}

//document.querySelector('.login-form').addEventListener('submit', loginFormHandler);

function registerClick(clicked_id) {
  let duplicateCheck = document.getElementsByClassName("tempPick");

  let clickedCheck = clicked_id.split(",", 1);
  let clickedCheckInt = parseInt(clickedCheck[0]);

  let duplicateCheckId = duplicateCheck;

  // @ts-ignore
  for (i = 0; i < duplicateCheck.length; i++) {
    // @ts-ignore
    duplicateCheckId = duplicateCheck[i].id;
    // @ts-ignore
    let duplicateCheckIdArr = duplicateCheckId.split(",", 1);
    let parsedDuplicateCheckId = parseInt(duplicateCheckIdArr[0]);

    if (clickedCheckInt === parsedDuplicateCheckId) {
      // @ts-ignore
      let extra = duplicateCheck[i];
      // @ts-ignore
      extra.removeAttribute("class", "tempPick");
    }
  }
  let pickedTeam = clicked_id;
  let pickedTeamDiv = document.getElementById(pickedTeam);
  // @ts-ignore
  pickedTeamDiv.setAttribute("class", "tempPick");
  let colorHelp = document.getElementsByClassName("tempPick");
  let coloredTrack;
  // @ts-ignore
  for (x = 0; x < colorHelp.length; x++) {
    // @ts-ignore
    coloredTrack = colorHelp[x].parentNode.parentNode;
    // @ts-ignore
    coloredTrack.classList.add("successfulPick");
  }
}

// Helper function to sort users by tracks left (descending - most tracks first)
function sortUsersByTracksLeft(users) {
  return users.sort((a, b) => {
    // Calculate tracks left for user A
    const aTracksLeft = a.tracks.filter(
      (track) => track.wrong_pick === null
    ).length;

    // Calculate tracks left for user B
    const bTracksLeft = b.tracks.filter(
      (track) => track.wrong_pick === null
    ).length;

    // Sort by tracks left (descending - most tracks first)
    // If tracks are equal, sort alphabetically by first name as tiebreaker
    if (bTracksLeft === aTracksLeft) {
      return a.first_name.localeCompare(b.first_name);
    }

    return bTracksLeft - aTracksLeft;
  });
}

// Updated leagueUserTableHandler function
async function leagueUserTableHandler() {
  let headerHelp = document.getElementsByTagName("header")[0];
  console.log(headerHelp);
  let currentWeekDiv = document.createElement("div");
  let currentWeekH1 = document.createElement("h1");
  let currentWeek = localStorage.getItem("thisWeek");
  currentWeekH1.innerHTML = `Week ${currentWeek}`;
  currentWeekDiv.appendChild(currentWeekH1);
  headerHelp.appendChild(currentWeekDiv);

  fetch("/api/users").then(function (response) {
    if (response.ok) {
      response.json().then(function (data) {
        console.log("Original data:", data);

        // Sort users by tracks left using our helper function
        const sortedData = sortUsersByTracksLeft(data);
        console.log("Sorted data:", sortedData);

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

        console.log(mainTable);

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
          const crownInfo = getCrownInfo(sortedData[i].user_record);

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
          console.log(sortedData[i]);
          // @ts-ignore
          let trackChecker = parseInt(currentWeek);
          trackChecker++;
          // @ts-ignore - using sortedData
          for (t = 0; t < sortedData[i].tracks.length - wrongPicksCount; t++) {
            console.log(trackChecker);
            // @ts-ignore
            console.log(sortedData[i].tracks[t].used_picks.length);
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

            console.log(matchingTracksCount);
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
              console.log(sortedData);
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
        finalScores();
      });
    } else {
      alert("Sorry, could not connect to database");
    }
  });
}

function adminHandler() {
  let actualAdminPass = "hi";
  // @ts-ignore
  let adminPassword = document
    .getElementById("adminPasswordInput")
    .value.trim();
  console.log(adminPassword);
  console.log(actualAdminPass);
  if (adminPassword === actualAdminPass) {
    location.href = "../admin.html";
  } else {
    alert("Sorry, you are not invited to this party");
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
        console.log("it worked");
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
        console.log("it worked");
      } else {
        alert(response.statusText);
      }
    }
  }

  location.reload();
}

async function createTrack(user_id) {
  console.log(nflArray2);
  // @ts-ignore
  let available_picks = nflArray2.map(getTeamNames);
  console.log(available_picks);
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
    console.log("CREATED TRACK");
    console.log(response);
  } else {
    alert(response.statusText);
  }
}

async function checkIfPicked() {}

function waitForLocalStorage(key, checkInterval = 500) {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      const value = localStorage.getItem(key);
      if (value) {
        clearInterval(interval);
        resolve(value);
      }
    }, checkInterval);

    // Optional: add a timeout if you want to avoid waiting forever
    setTimeout(() => {
      clearInterval(interval);
      reject(new Error(`Timeout waiting for ${key} in localStorage`));
    }, 10000); // wait for up to 10 seconds
  });
}

async function forcePickCheckTime() {
  let weekNumberString = localStorage.getItem("thisWeek");
  let weekNumber = parseInt(weekNumberString, 10);

  try {
    // Fetch schedule from ESPN API (you might still want to do this to get additional details)
    const response = await fetch(
      `https://pacific-anchorage-21728.herokuapp.com/https://cdn.espn.com/core/nfl/schedule?xhr=1&year=2025&week=${weekNumber}`
    );
    const data = await response.json();

    // Get the current moment in time
    let currentMoment = Date.now();

    // Get the current date and time in Utah (Mountain Time)
    const utahTime = new Date().toLocaleString("en-US", {
      timeZone: "America/Denver",
    });
    const currentDateInUtah = new Date(utahTime);

    // Create a Date object for the current Thursday at 6:20 PM Utah time
    const thursdayGameTime = new Date(currentDateInUtah);
    thursdayGameTime.setHours(18, 20, 0, 0); // Set time to 6:20 PM Utah time

    // Get the current day in Utah
    const utahDayFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Denver",
      weekday: "long",
    });
    const currentDayInUtah = utahDayFormatter.format(currentDateInUtah);

    // Check if it's Thursday
    if (currentDayInUtah !== "Thursday") {
      console.log(
        "Today is not Thursday in Utah. forcePicks() will not be called."
      );
      return;
    }

    // Compare the current time with the 6:20 PM Thursday time
    if (currentMoment > thursdayGameTime.getTime()) {
      // Call forcePicks if the current time is after 6:20 PM
      // forcePicks(weekNumber);
      console.log("It is past 6:20 PM on Thursday, calling forcePicks()...");
    } else {
      console.log("It is not yet 6:20 PM on Thursday.");
    }
  } catch (error) {
    console.error("Error fetching the schedule data:", error);
  }
}

async function forcePicks(weekNumber) {
  //YOU DIDN"T TAKE INTO ACCOUNT TH BYE WEEK
  // Get the current week call count from localStorage
  const forcePickCalls =
    JSON.parse(localStorage.getItem("forcePickCalls")) || {};

  // If forcePicks has already been called for this week, exit
  if (forcePickCalls[weekNumber] && forcePickCalls[weekNumber] >= 1) {
    console.log(`forcePicks already called for week ${weekNumber}.`);
    return;
  }

  // Check if forcePicks is already running by looking for a lock
  if (localStorage.getItem("forcePicksInProgress") === "true") {
    console.log(`forcePicks is already in progress.`);
    return;
  }

  // Set a lock to prevent multiple calls
  localStorage.setItem("forcePicksInProgress", "true");

  try {
    // Increment the call count for this week and save it in localStorage
    forcePickCalls[weekNumber] = (forcePickCalls[weekNumber] || 0) + 1;
    localStorage.setItem("forcePickCalls", JSON.stringify(forcePickCalls));

    // Fetch all alive tracks (wrong_pick is null)
    const response = await fetch("/api/tracks/all-tracks/alive-without-pick");
    const aliveTracks = await response.json();

    // Loop through each alive track and make random picks if current_pick is null
    for (const track of aliveTracks) {
      if (!track.current_pick) {
        const availablePicks = track.available_picks;

        // If no available picks, skip this track
        if (availablePicks.length === 0) {
          console.log(`No available picks left for track ${track.id}.`);
          continue;
        }

        // Randomly select a pick from available_picks
        const randomPick =
          availablePicks[Math.floor(Math.random() * availablePicks.length)];

        // Update the track with the random pick
        const updatedTrack = await updateTrackPick(track.id, randomPick);
        console.log(`Track ${track.id} assigned pick: ${randomPick}`);
      }
    }

    console.log("All tracks have been processed for force picks.");
  } catch (error) {
    console.error("Error during forcePicks:", error);
  } finally {
    // Remove the lock after the function completes
    localStorage.removeItem("forcePicksInProgress");
    location.href = "../league-page.html";
  }
}

// Function to update the track with a random valid pick
async function updateTrackPick(trackId, randomPick) {
  try {
    const response = await fetch(`/api/tracks/${trackId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        current_pick: randomPick,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to update the track.");
    }

    const updatedTrack = await response.json();
    return updatedTrack;
  } catch (error) {
    console.error(`Error updating track ${trackId}:`, error);
    return null;
  }
}

async function displayTeamLogo() {
  fetch(
    `https://pacific-anchorage-21728.herokuapp.com/https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams`
  ).then(function (response) {
    if (response.ok) {
      response.json().then(function (data) {
        console.log(data);
        let textPicks = document.getElementsByClassName("teamNames");
        console.log(textPicks);
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

async function espnFetchTeam() {}

async function getAliveTracksByUserId(userId) {
  let response = await fetch(`/api/tracks/user/${userId}/alive`);
  if (response.ok) {
    let tracks = await response.json();
    console.log(tracks);
    return tracks;
  } else if (response.status === 404) {
    console.warn("No tracks available for user.");
    return "No tracks alive";
  } else {
    console.error(
      "Failed to fetch alive tracks for user",
      await response.text()
    );
    return [];
  }
}

function pushToLeaguePage() {
  let userId = localStorage.getItem("loggedInUserId");
  let currentWeek = parseInt(localStorage.getItem("thisWeek"), 10);

  getAliveTracksByUserId(userId)
    .then((tracks) => {
      if (tracks.length === 0) {
        console.log("No tracks available.");
        return; // Exit the function early without redirecting
      }
      if (tracks === "No tracks alive") {
        window.location.href = "../league-page.html";
      }
      if (tracks.every((track) => track.used_picks.length >= currentWeek)) {
        window.location.href = "../league-page.html";
      } else {
        console.log("Not all tracks meet the current week criteria.");
      }
    })
    .catch((error) => {
      console.error("Error in fetching tracks:", error);
    });
}

async function resetWrongPick(trackId) {
  try {
    if (!trackId) {
      throw new Error("Track ID is required");
    }

    const response = await fetch(`/reset-wrong-pick/${trackId}`, {
      method: "PUT",
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error);
    }

    console.log("Wrong pick reset successfully");
  } catch (error) {
    console.error("Error resetting wrong pick:", error.message);
  }
}

async function getTracksWithNonNullWrongPick(userId) {
  try {
    if (!userId) {
      throw new Error("User ID is required");
    }

    const response = await fetch(`/wrong-pick-not-null/${userId}`, {
      method: "GET",
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error);
    }

    const data = await response.json();
    console.log("Fetched tracks successfully:", data);
  } catch (error) {
    console.error("Error fetching tracks:", error.message);
  }
}
