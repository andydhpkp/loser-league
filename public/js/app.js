const match = require("nodemon/lib/monitor/match");

function getTeamNames(names) {
  return names.teamName;
}

async function displayUsers() {
  //data-bs-toggle="modal" data-bs-target="#adminPassword" href="#
  fetch("/api/users").then(function (response) {
    if (response.ok) {
      response.json().then(function (data) {
        let adminViewUserDiv = document.getElementById("adminUsers");

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
        trackSubmitBtn.innerText = "Submit Tracks";
        // @ts-ignore
        adminViewUserDiv.appendChild(trackSubmitBtn);
      });
    } else {
      alert("Sorry, could not connect to database");
    }
  });
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
  fetch(`/api/users/`).then(function (response) {
    if (response.ok) {
      response.json().then(function (data) {
        let loggedInUsername = localStorage.getItem("loggedInUser");
        let loggedInUserId;
        console.log(loggedInUsername);
        // @ts-ignore
        for (i = 0; i < data.length; i++) {
          console.log(data);
          // @ts-ignore
          if (data[i].username.toLowerCase() === loggedInUsername) {
            // @ts-ignore
            loggedInUserId = data[i].id;
            console.log(loggedInUserId);
          }
        }
        localStorage.setItem("loggedInUserId", loggedInUserId);
      });
    } else {
      // @ts-ignore
      alert(response.error);
    }
  });
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
      location.href = "../league-page.html";
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
        console.log(data);
        let largestPickLength = 0;
        //find the picks length
        // @ts-ignore
        for (p = 0; p < data.length; p++) {
          let validTracks = data[p].tracks.filter((track) => !track.wrong_pick);
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
        let firstScope = document.createElement("th");
        firstScope.setAttribute("scope", "col");

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

        trHead.appendChild(firstScope);
        trHead.appendChild(secondScope);
        trHead.appendChild(thirdScope);
        trHead.appendChild(fourthScope);
        trHead.appendChild(fifthScope);
        trHead.appendChild(sixthScope);
        tHead.appendChild(trHead);
        mainTable.appendChild(tHead);

        console.log(mainTable);

        let tBody = document.createElement("tbody");

        // @ts-ignore
        for (i = 0; i < data.length; i++) {
          let eliminated = false;
          let tr = document.createElement("tr");
          let th = document.createElement("th");
          th.setAttribute("scope", "row");
          // @ts-ignore
          th.innerText = i + 1;
          tr.appendChild(th);

          let tdFirst = document.createElement("td");
          // @ts-ignore
          tdFirst.innerText = data[i].first_name;
          let tdLast = document.createElement("td");
          // @ts-ignore
          tdLast.innerText = data[i].last_name;
          let tdTracks = document.createElement("td");
          // @ts-ignore
          const wrongPicksCount = data[i].tracks.filter(
            (track) => track.wrong_pick !== null
          ).length;
          tdTracks.innerText = data[i].tracks.length - wrongPicksCount;

          if (tdTracks.innerText === "0") {
            eliminated = true;
          }

          let tdSubmitted = document.createElement("td");
          let submitted = "No";

          // @ts-ignore
          console.log(data[i]);
          // @ts-ignore
          let trackChecker = parseInt(currentWeek);
          trackChecker++;
          // @ts-ignore
          for (t = 0; t < data[i].tracks.length - wrongPicksCount; t++) {
            console.log(trackChecker);
            // @ts-ignore
            console.log(data[i].tracks[t].used_picks.length);
            // @ts-ignore
            // @ts-ignore
            //
            const matchingTracksCount = data[i].tracks.filter(
              (track) => track.used_picks.length === parseInt(currentWeek)
            ).length;
            if (
              matchingTracksCount >=
              data[i].tracks.length - wrongPicksCount
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

          // @ts-ignore
          // Filter the tracks first
          let validTracks = data[i].tracks.filter(
            (track) => track.wrong_pick === null
          );

          for (x = 0; x < largestPickLength; x++) {
            try {
              console.log(data);
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

async function forcePicks() {
  fetch("/api/users").then(function (response) {
    if (response.ok) {
      response.json().then(function (data) {
        let currentWeek = localStorage.getItem("thisWeek");

        console.log(data);

        // @ts-ignore
        for (i = 0; i < data.length; i++) {
          let submitted = "Yes";
          // @ts-ignore
          let trackChecker = parseInt(currentWeek);
          trackChecker++;

          // @ts-ignore
          for (t = 0; t < data[i].tracks.length; t++) {
            // @ts-ignore
            console.log(data[i].tracks[t].used_picks.length);
            // @ts-ignore
            console.log(data[i].username);
            // @ts-ignore
            if (data[i].tracks[t].used_picks.length < trackChecker) {
              submitted = "No";
            }
            console.log(submitted);
          }

          if (submitted === "No") {
            // @ts-ignore
            if (data[i].tracks.length > 0) {
              // @ts-ignore
              for (x = 0; x < data[i].tracks.length; x++) {
                // @ts-ignore
                let putTrackId = data[i].tracks[x].id;
                // @ts-ignore
                let randomPicker = Math.floor(
                  Math.random() * data[i].tracks[x].available_picks.length
                );
                console.log("create function");
                // @ts-ignore
                let randomPick =
                  data[i].tracks[x].available_picks[randomPicker];
                console.log(randomPick);
                // @ts-ignore
                let used_picks = data[i].tracks[x].used_picks;
                used_picks.push(randomPick);
                // @ts-ignore
                let available_picks = data[i].tracks[x].available_picks;
                available_picks = available_picks.filter(
                  (item) => item !== randomPick
                );
                // @ts-ignore
                let user_id = data[i].id;
                makePick(
                  available_picks,
                  used_picks,
                  randomPick,
                  user_id,
                  putTrackId
                );
              }
            }
          }
        }
      });
    } else {
      alert("Could not connect");
    }
  });
}

function timeToForce() {
  let currentMoment = new Date();

  let checkMatchupDay = currentMoment.getUTCDay();

  console.log("check day for force");

  console.log(checkMatchupDay);

  //Utah is -7 or -6 UTC depending on daylight savings FYI

  if (checkMatchupDay >= 5) {
    console.log("You Snooze You Loose");
    //forcePicks()
  }
}
//3600000
setInterval(timeToForce, 3600000);

async function displayTeamLogo() {
  fetch(
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams`
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
    return [];
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
