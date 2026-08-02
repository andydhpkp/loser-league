export function buildOnboardingView(onboarding) {
  const contacts = Array.isArray(onboarding?.contacts)
    ? onboarding.contacts.map((contact) => ({ ...contact, label: `Text ${contact.name} for help` }))
    : [];
  const payment = onboarding?.enrollmentOpen && onboarding.payment
    ? { ...onboarding.payment, label: `Pay Tate on Venmo (${onboarding.payment.handle})` }
    : null;
  if (!contacts.length && !payment) {
    return {
      heading: onboarding?.enrollmentOpen ? "Ready to play?" : "Track enrollment is closed",
      explanation: "You don’t have any Tracks for this League Season. Contact a league organizer for help joining.",
      notice: null,
      contacts,
      payment,
      fallback: true,
    };
  }
  return onboarding.enrollmentOpen
    ? {
      heading: "Ready to play?",
      explanation: `In order to pick your teams, you need to pay to play. Tracks are ${onboarding.price} each.`,
      notice: "After paying, please give us some time to add your Tracks. Track creation is a manual admin step.",
      contacts,
      payment,
      fallback: false,
    }
    : {
      heading: "Track enrollment is closed",
      explanation: "You don’t have any Tracks for this League Season. Payment and new Track requests are currently closed.",
      notice: null,
      contacts,
      payment: null,
      fallback: false,
    };
}

export function renderOnboardingPanel(container, onboarding, { onRefresh } = {}) {
  const view = buildOnboardingView(onboarding);
  container.replaceChildren();
  const panel = document.createElement("section");
  panel.className = "zero-track-panel";
  panel.setAttribute("aria-labelledby", "zeroTrackHeading");
  const heading = document.createElement("h2");
  heading.id = "zeroTrackHeading";
  heading.textContent = view.heading;
  panel.append(heading);
  const explanation = document.createElement("p");
  explanation.textContent = view.explanation;
  panel.append(explanation);
  const actions = document.createElement("div");
  actions.className = "zero-track-actions";
  if (view.payment) {
    const link = document.createElement("a");
    link.className = "btn btn-primary";
    link.href = view.payment.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = view.payment.label;
    actions.append(link);
  }
  for (const contact of view.contacts) {
    const wrapper = document.createElement("p");
    const link = document.createElement("a");
    link.href = contact.smsUrl;
    link.textContent = contact.label;
    wrapper.append(link, document.createTextNode(` — ${contact.formattedPhone}`));
    actions.append(wrapper);
  }
  panel.append(actions);
  if (view.notice) {
    const notice = document.createElement("p");
    notice.className = "zero-track-notice";
    notice.textContent = view.notice;
    panel.append(notice);
  }
  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.className = "btn btn-outline-primary";
  refresh.textContent = "Refresh Tracks";
  refresh.addEventListener("click", () => onRefresh?.());
  panel.append(refresh);
  container.append(panel);
}
