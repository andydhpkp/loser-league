import { loadDashboard } from "../modules/dashboard.js";
import { logout } from "../logout.js";
import { registerPwa } from "../modules/pwa-registration.js";

document.getElementById("logoutBtn")?.addEventListener("click", logout);
document.getElementById("retryDashboard")?.addEventListener("click", () => loadDashboard({ document }));
loadDashboard({ document });
registerPwa({ onUpdate: () => document.dispatchEvent(new document.defaultView.CustomEvent("loser-league:update-available")) });
