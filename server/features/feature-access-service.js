const { FeatureRelease, UserFeatureEntitlement, UserFeatureAccessState } = require("../../models");
const PICK_REMINDERS = "PICK_REMINDERS";
const GRACE_MS = 30 * 24 * 60 * 60 * 1000;

async function getPickRemindersAccess({ userId, systemAvailable, transaction }) {
  const [release, entitlement, accessState] = await Promise.all([
    FeatureRelease.findByPk(PICK_REMINDERS, { attributes: ["public_released", "state_version"], transaction }),
    UserFeatureEntitlement.findOne({ where: { user_id: userId, feature_key: PICK_REMINDERS }, attributes: ["enabled", "state_version"], transaction }),
    UserFeatureAccessState.findOne({ where: { user_id: userId, feature_key: PICK_REMINDERS }, attributes: ["access_removed_at", "grace_expires_at"], transaction }),
  ]);
  const entitled = entitlement?.enabled === true;
  const publicReleased = release?.public_released === true;
  return {
    effective: systemAvailable === true && (publicReleased || entitled),
    betaAccess: { enabled: entitled, stateVersion: entitlement?.state_version || 0 },
    release: { publicReleased, stateVersion: release?.state_version || 0 },
    grace: accessState?.access_removed_at ? { accessRemovedAt: accessState.access_removed_at, expiresAt: accessState.grace_expires_at } : null,
  };
}

async function getPickRemindersRelease() {
  const release = await FeatureRelease.findByPk(PICK_REMINDERS, { attributes: ["public_released", "state_version"] });
  return { publicReleased: release?.public_released === true, stateVersion: release?.state_version || 0 };
}

function graceState(now = new Date()) { return { access_removed_at: now, grace_expires_at: new Date(now.getTime() + GRACE_MS) }; }
module.exports = { GRACE_MS, PICK_REMINDERS, getPickRemindersAccess, getPickRemindersRelease, graceState };
