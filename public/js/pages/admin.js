import { displayUsers } from "../modules/admin-management.js";
import { logout } from "../logout.js";

document.getElementById("logoutBtn")?.addEventListener("click", logout);
displayUsers();
