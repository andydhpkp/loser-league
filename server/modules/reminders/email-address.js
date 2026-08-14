const { ValidationError } = require("../../lib/errors");
const { domainToASCII } = require("node:url");

function normalizeEmail(value) {
  if (typeof value !== "string") throw new ValidationError("Account email is invalid");
  const trimmed = value.trim();
  const at = trimmed.lastIndexOf("@");
  if (at < 1 || at === trimmed.length - 1) throw new ValidationError("Account email is invalid");
  const local = trimmed.slice(0, at);
  const domain = domainToASCII(trimmed.slice(at + 1).toLowerCase());
  if (!local || !domain || /[\r\n]/.test(trimmed)) throw new ValidationError("Account email is invalid");
  return `${local}@${domain}`;
}

function maskEmail(value) {
  const normalized = normalizeEmail(value);
  const at = normalized.lastIndexOf("@");
  return `${normalized.slice(0, 1)}•••${normalized.slice(at)}`;
}

module.exports = { maskEmail, normalizeEmail };
