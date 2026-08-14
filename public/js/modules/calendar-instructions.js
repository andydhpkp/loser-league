/* global URL */
export const CALENDAR_INSTRUCTIONS = Object.freeze({
  apple: Object.freeze({
    title: "Apple Calendar",
    subscribe: "Open the subscription link, or add a Subscription Calendar and paste the calendar URL.",
    remove: "Open the calendar's information and choose Unsubscribe.",
  }),
  google: Object.freeze({
    title: "Google Calendar",
    subscribe: "On a computer, choose Add calendar, From URL, paste the HTTPS subscription URL, and add the calendar.",
    remove: "Open Settings, select the calendar, choose Remove calendar, then Unsubscribe.",
  }),
  outlook: Object.freeze({
    title: "Outlook",
    subscribe: "On the web, choose Add calendar, Subscribe from web, paste the HTTPS subscription URL, and import the subscription. Do not upload the file, because an imported file does not receive updates.",
    remove: "Select the subscribed calendar and choose Remove or Unsubscribe.",
  }),
  limitations: "Your calendar application controls refresh and notification behavior. It may change, replace, or ignore the suggested 24-hour alert. These are general deadline reminders and may still alert after your Picks are complete. Loser League cannot detect, verify, or disable your external subscription.",
});

export function calendarLinks(httpsUrl) {
  const parsed = new URL(httpsUrl);
  if (parsed.protocol !== "https:") throw new TypeError("Calendar subscription URL must use HTTPS");
  return { https: parsed.href, webcal: parsed.href.replace(/^https:/, "webcal:") };
}
