import { browserLogger } from "../logger.js";

let i;
let j;
let x;

export async function getUserId() {
  try {
    const response = await fetch(`/api/users/`);
    if (response.ok) {
      const data = await response.json();
      const loggedInUsername = localStorage.getItem("loggedInUser");
      if (!loggedInUsername) {
        browserLogger.error("No logged in username found in local storage.");
        return null;
      }

      const matchedUser = data.find(
        (user) => user.username.toLowerCase() === loggedInUsername.toLowerCase()
      );

      if (matchedUser) {
        const loggedInUserId = matchedUser.id;
        browserLogger.debug(`User ID found: ${loggedInUserId}`);
        localStorage.setItem("loggedInUserId", loggedInUserId);
        return loggedInUserId;
      } else {
        browserLogger.error("No matching user found.");
        return null;
      }
    } else {
      browserLogger.error("Failed to fetch users.");
      return null;
    }
  } catch (error) {
    browserLogger.error("An error occurred while fetching the user ID:", error);
    return null;
  }
}

export async function handleSubmitPicks() {
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
          updatePromises.push(submitTrackPick(id, pick));
        }
      }
    });

    // Wait for all updateTrackPick promises to resolve
    try {
      await Promise.all(updatePromises);
      window.location.replace("../league-page.html");
    } catch (error) {
      browserLogger.error("Error updating some tracks:", error);
      alert("There was an error updating your picks. Please try again.");
    }
  } else {
    alert("Please make a selection for each matchup before submitting!");
  }
}

function submitTrackPick(trackId, currentPick) {
  // Create the request payload
  const payload = {
    current_pick: currentPick,
  };

  // Make a PUT request to the server with the track ID and the current pick
  return fetch(`/api/tracks/${trackId}`, {
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
        browserLogger.debug("Track updated successfully!", data);
      } else {
        browserLogger.error("Error updating track");
        throw new Error("Error updating track"); // Throw an error to be caught in catch() block
      }
    })
    .catch((error) => {
      browserLogger.error("There was an error updating the track:", error);
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
  const response = await fetch(`/api/tracks/${putTrackId}`, {
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
    browserLogger.debug("updated");
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
