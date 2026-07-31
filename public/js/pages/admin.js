import {
  displayUsers,
  logoutAdmin,
} from "../modules/admin-management.js";

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  try {
    await logoutAdmin();
    location.href = "/index.html";
  } catch (_error) {
    alert("Unable to log out. Please try again.");
  }
});
displayUsers();
