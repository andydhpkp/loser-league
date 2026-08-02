import { adminHandler } from "../modules/admin-management.js";
import { bindLoginForm } from "../login.js";
import { bindResetPassword } from "../reset-password.js";
import {
  doTeamsExist,
} from "../teams.js";

bindLoginForm();
bindResetPassword();

document
  .querySelector("#adminPassword .btn-primary")
  ?.addEventListener("click", adminHandler);

doTeamsExist();
