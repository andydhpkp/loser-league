const { ReminderPreference } = require("../../../models");
const { ValidationError } = require("../../lib/errors");

function createReminderPreferenceService({
  findPreference = (userId) => ReminderPreference.findByPk(userId),
  savePreference = ({ userId, emailEnabled, pushEnabled, stateVersion }) => ReminderPreference.upsert({ user_id: userId, email_enabled: emailEnabled, push_enabled: pushEnabled, state_version: stateVersion }),
} = {}) {
  const view = (preference) => ({ emailEnabled: preference?.email_enabled === true, pushEnabled: preference?.push_enabled === true, stateVersion: preference?.state_version || 0 });
  async function get(userId) {
    if (!Number.isInteger(userId) || userId < 1) throw new ValidationError("User ID is invalid");
    return view(await findPreference(userId));
  }
  async function setChannel(userId, channel, enabled) {
    if (channel !== "EMAIL" && channel !== "PUSH") throw new ValidationError("Reminder channel is invalid");
    if (typeof enabled !== "boolean") throw new ValidationError("Reminder preference must be a boolean");
    const current = await get(userId);
    const updated = { ...current, [channel === "EMAIL" ? "emailEnabled" : "pushEnabled"]: enabled, stateVersion: current.stateVersion + 1 };
    await savePreference({ userId, ...updated });
    return updated;
  }
  return { get, setChannel };
}

module.exports = { createReminderPreferenceService };
