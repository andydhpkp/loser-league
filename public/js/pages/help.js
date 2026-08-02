import { logout } from "../logout.js";

async function loadContacts() {
  const container = document.getElementById("supportContacts");
  try {
    const response = await fetch("/api/user/league/support", { headers: { Accept: "application/json" } });
    if (response.status === 401) { location.href = "/index.html"; return; }
    if (!response.ok) throw new Error("Support request failed");
    const { contacts = [] } = await response.json();
    container.replaceChildren();
    if (!contacts.length) { container.textContent = "Contact options are temporarily unavailable."; return; }
    for (const contact of contacts) {
      const link = document.createElement("a"); link.className = "btn btn-outline-primary me-2 mb-2"; link.href = contact.smsUrl; link.textContent = `Text ${contact.name} for help`; container.append(link);
    }
  } catch (_error) { container.textContent = "Contact options are temporarily unavailable."; }
}

document.getElementById("logoutBtn")?.addEventListener("click", logout);
loadContacts();
