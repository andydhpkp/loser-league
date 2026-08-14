function classifySmtpResult({ info, error }) {
  if (info?.accepted?.length) return "ACCEPTED";
  if (!error) return "UNKNOWN";
  if (error.responseCode === 454) return "TEMPORARY_FAILURE";
  if (["EAUTH", "ENOAUTH", "EOAUTH2"].includes(error.code) || error.responseCode === 535) return "AUTHENTICATION_FAILURE";
  if (Number.isInteger(error.responseCode)) {
    if (error.responseCode >= 400 && error.responseCode < 500) return "TEMPORARY_FAILURE";
    if (error.responseCode === 550 && /\b5\.4\.5\b/.test(error.response || "")) return "TEMPORARY_FAILURE";
    if (error.responseCode >= 500 && error.responseCode < 600) return "PERMANENT_FAILURE";
  }
  return "UNKNOWN";
}
function createGmailTransport({ nodemailer, configuration }) {
  const transporter = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, requireTLS: true, auth: { user: configuration.gmailUser, pass: configuration.gmailAppPassword }, tls: { minVersion: "TLSv1.2", rejectUnauthorized: true }, connectionTimeout: 30_000, greetingTimeout: 30_000, socketTimeout: 60_000, logger: false, debug: false });
  return { async send(message) { try { return { classification: classifySmtpResult({ info: await transporter.sendMail(message) }) }; } catch (error) { return { classification: classifySmtpResult({ error }) }; } } };
}
module.exports = { classifySmtpResult, createGmailTransport };
