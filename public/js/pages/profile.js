import { pushToLeaguePage } from "../modules/profile-navigation.js";
import { bindPickReview, getUserId } from "../modules/track-actions.js";
import { initializeAutoPickCheck } from "../force-picks.js";
import { logout } from "../logout.js";
import { getTrackNumber } from "../teams.js";

document.getElementById("logoutBtn")?.addEventListener("click", logout);
bindPickReview();
getTrackNumber();
getUserId();
pushToLeaguePage();
initializeAutoPickCheck();
