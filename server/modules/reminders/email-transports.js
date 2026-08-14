const { buildReminderEmail, buildVerificationEmail } = require("./email-content");
function createEmailTransports({ gmailTransport, configuration }) {
  const envelope = (destination, content) => ({ from: `Loser League Reminders <${configuration.from}>`, replyTo: configuration.replyTo, to: destination, subject: content.subject, text: content.text, disableFileAccess: true, disableUrlAccess: true });
  return {
    sendVerification({ destination, token }) { return gmailTransport.send(envelope(destination, buildVerificationEmail({ origin: configuration.publicAppOrigin, token }))); },
    sendReminder({ destination, optOutToken }) { return gmailTransport.send(envelope(destination, buildReminderEmail({ origin: configuration.publicAppOrigin, optOutToken }))); },
  };
}
module.exports = { createEmailTransports };
