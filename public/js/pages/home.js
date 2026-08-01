import { adminHandler } from "../modules/admin-management.js";
import { bindLoginForm } from "../login.js";
import { bindResetPassword } from "../reset-password.js";
import {
  doTeamsExist,
  getCurrentWeek,
  getEndOfGameTime,
} from "../teams.js";

bindLoginForm();
bindResetPassword();

document
  .querySelector("#adminPassword .btn-primary")
  ?.addEventListener("click", adminHandler);

const loggedInUser = window.localStorage.getItem("loggedInUser");
if (loggedInUser) {
  location.href = "../profile.html";
} else {
  doTeamsExist();
  getEndOfGameTime();
  getCurrentWeek();
}
