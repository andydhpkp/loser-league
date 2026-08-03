import { browserLogger } from "../logger.js";

let i;
let j;
let x;

export async function getUserId() {
  try {
    const response = await fetch("/api/users/logged");
    if (response.ok) {
      const data = await response.json();
      if (data?.id) {
        const loggedInUserId = data.id;
        browserLogger.debug(`User ID found: ${loggedInUserId}`);
        localStorage.setItem("loggedInUserId", loggedInUserId);
        return loggedInUserId;
      }
      return null;
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
  const selections = collectDraftSelections();
  if (selections.some((selection) => !selection.teamName)) {
    alert("Please make a selection for each matchup before submitting!");
    return;
  }
  const list = document.getElementById("pickReviewList");
  list.replaceChildren(...selections.map((selection, index) => {
    const item = document.createElement("li");
    item.textContent = formatPickReviewLabel(selection, index);
    return item;
  }));
  document.getElementById("pickReviewModal").dataset.selections = JSON.stringify(selections);
  window.bootstrap.Modal.getOrCreateInstance(document.getElementById("pickReviewModal")).show();
}

export function formatPickReviewLabel({ teamName }, index) {
  return `Track ${index + 1}: ${teamName}`;
}

export function collectDraftSelections() {
  return Array.from(document.querySelectorAll(".trackContainer")).map((container) => {
    const [trackId, teamName = ""] = (container.querySelector(".tempSelection")?.value || `${container.id},`).split(",");
    return { trackId: Number(trackId), stateVersion: Number(container.dataset.stateVersion), teamName };
  });
}

export function bindPickReview() {
  document.getElementById("confirmPickSubmission")?.addEventListener("click", async () => {
    const modal = document.getElementById("pickReviewModal");
    const button = document.getElementById("confirmPickSubmission");
    const error = document.getElementById("pickReviewError");
    button.disabled = true;
    error.hidden = true;
    try {
      const response = await fetch("/api/user/league/submission", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selections: JSON.parse(modal.dataset.selections) }) });
      if (!response.ok) throw new Error((await response.json()).message || "Submission failed");
      window.location.replace("../league-page.html");
    } catch (submissionError) {
      error.textContent = submissionError.message;
      error.hidden = false;
      button.disabled = false;
    }
  });
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
