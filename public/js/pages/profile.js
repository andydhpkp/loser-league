import { pushToLeaguePage } from "../modules/profile-navigation.js";
import { getUserId } from "../modules/track-actions.js";
import { initializeAutoPickCheck } from "../force-picks.js";
import { logout } from "../logout.js";
import { getCurrentWeek, getTrackNumber } from "../teams.js";

document.getElementById("logoutBtn")?.addEventListener("click", logout);
getTrackNumber();
getUserId();
getCurrentWeek();
pushToLeaguePage();
initializeAutoPickCheck();
