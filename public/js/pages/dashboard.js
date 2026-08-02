import { loadDashboard } from "../modules/dashboard.js";
import { logout } from "../logout.js";

document.getElementById("logoutBtn")?.addEventListener("click", logout);
document.getElementById("retryDashboard")?.addEventListener("click", () => loadDashboard({ document }));
loadDashboard({ document });
