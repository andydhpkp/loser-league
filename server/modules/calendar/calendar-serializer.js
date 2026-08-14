const UID_DOMAIN = "calendar.loser-league.app";

function stableEventUid({ year, phase, round }) {
  return `pick-deadline-${Number(year)}-${String(phase).toLowerCase()}-${Number(round)}@${UID_DOMAIN}`;
}

function utcTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Calendar timestamp is invalid");
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeText(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function foldLine(line) {
  const chunks = [];
  let current = "";
  let bytes = 0;
  for (const character of line) {
    const size = Buffer.byteLength(character);
    const limit = chunks.length ? 74 : 75;
    if (bytes + size > limit) {
      chunks.push(current);
      current = ` ${character}`;
      bytes = 1 + size;
    } else {
      current += character;
      bytes += size;
    }
  }
  chunks.push(current);
  return chunks.join("\r\n");
}

function serializeCalendar({ events, dashboardUrl }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Loser League//Pick Deadlines//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const event of [...events].sort((a, b) => new Date(a.deadline) - new Date(b.deadline) || a.uid.localeCompare(b.uid))) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeText(event.uid)}`,
      `DTSTAMP:${utcTimestamp(event.revisedAt)}`,
      `DTSTART:${utcTimestamp(event.deadline)}`,
      `SEQUENCE:${Number(event.sequence)}`,
      `STATUS:${event.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED"}`,
      "SUMMARY:Loser League Picks Due",
      `URL:${dashboardUrl}`,
    );
    if (event.status !== "CANCELLED") lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-PT24H", "DESCRIPTION:Loser League Picks Due", "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

module.exports = { escapeText, foldLine, serializeCalendar, stableEventUid, utcTimestamp };
