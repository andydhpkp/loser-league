//going to need to do a belongs to for future model of picks
const User = require('./User')
const Track = require('./Track')
const Team = require('./Team')
const LeagueSeason = require('./LeagueSeason')
const Pick = require('./Pick')
const ScheduleSnapshot = require('./ScheduleSnapshot')
const LeagueWeekOperation = require('./LeagueWeekOperation')
const AdminActionPreview = require('./AdminActionPreview')
const AdminAuditOperation = require('./AdminAuditOperation')
const AdminAuditTarget = require('./AdminAuditTarget')
const OfficialGameResultOverride = require('./OfficialGameResultOverride')
const TrackReactivation = require('./TrackReactivation')
const BuybackDecision = require('./BuybackDecision')
const BuybackDecisionTrack = require('./BuybackDecisionTrack')
const FeatureRelease = require('./FeatureRelease')
const UserFeatureEntitlement = require('./UserFeatureEntitlement')
const UserFeatureAccessState = require('./UserFeatureAccessState')
const FeatureAdminAuditTarget = require('./FeatureAdminAuditTarget')
const ReminderPreference = require('./ReminderPreference')
const ReminderCampaign = require('./ReminderCampaign')
const ReminderDelivery = require('./ReminderDelivery')
const PushSubscription = require('./PushSubscription')
const PushDeviceDelivery = require('./PushDeviceDelivery')
const EmailReminderVerification = require('./EmailReminderVerification')
const EmailVerificationRequest = require('./EmailVerificationRequest')
const EmailOptOutToken = require('./EmailOptOutToken')
const EmailProviderHealth = require('./EmailProviderHealth')
const CalendarEvent = require('./CalendarEvent')
const CalendarFeedState = require('./CalendarFeedState')

User.hasMany(Track, {
    foreignKey: 'user_id'
})

Track.belongsTo(User, {
    foreignKey: 'user_id',
    onDelete: 'SET NULL'
})

LeagueSeason.hasMany(Track, {
    as: 'tracks',
    foreignKey: 'league_season_id'
})

Track.belongsTo(LeagueSeason, {
    as: 'leagueSeason',
    foreignKey: 'league_season_id'
})

Track.hasMany(Pick, {
    as: 'picks',
    foreignKey: 'track_id',
    onDelete: 'CASCADE'
})

Pick.belongsTo(Track, {
    as: 'track',
    foreignKey: 'track_id'
})

LeagueSeason.hasMany(Pick, {
    as: 'picks',
    foreignKey: 'league_season_id'
})

Pick.belongsTo(LeagueSeason, {
    as: 'leagueSeason',
    foreignKey: 'league_season_id'
})

Track.belongsTo(Pick, {
    as: 'eliminatingPick',
    foreignKey: 'eliminated_by_pick_id',
    constraints: false
})

LeagueSeason.hasMany(ScheduleSnapshot, {
    as: 'scheduleSnapshots',
    foreignKey: 'league_season_id'
})

ScheduleSnapshot.belongsTo(LeagueSeason, {
    as: 'leagueSeason',
    foreignKey: 'league_season_id'
})

LeagueSeason.hasMany(LeagueWeekOperation, {
    as: 'weekOperations',
    foreignKey: 'league_season_id'
})

LeagueWeekOperation.belongsTo(LeagueSeason, {
    as: 'leagueSeason',
    foreignKey: 'league_season_id'
})

LeagueSeason.hasMany(AdminActionPreview, { as: 'adminActionPreviews', foreignKey: 'league_season_id' })
AdminActionPreview.belongsTo(LeagueSeason, { as: 'leagueSeason', foreignKey: 'league_season_id' })
LeagueSeason.hasMany(AdminAuditOperation, { as: 'adminAuditOperations', foreignKey: 'league_season_id' })
AdminAuditOperation.belongsTo(LeagueSeason, { as: 'leagueSeason', foreignKey: 'league_season_id' })
AdminAuditOperation.hasMany(AdminAuditTarget, { as: 'targets', foreignKey: 'admin_audit_operation_id' })
AdminAuditTarget.belongsTo(AdminAuditOperation, { as: 'operation', foreignKey: 'admin_audit_operation_id' })
AdminActionPreview.belongsTo(AdminAuditOperation, { as: 'auditOperation', foreignKey: 'audit_operation_id' })
LeagueSeason.hasMany(OfficialGameResultOverride, { as: 'officialResultOverrides', foreignKey: 'league_season_id' })
OfficialGameResultOverride.belongsTo(LeagueSeason, { as: 'leagueSeason', foreignKey: 'league_season_id' })
OfficialGameResultOverride.belongsTo(AdminAuditOperation, { as: 'auditOperation', foreignKey: 'admin_audit_operation_id' })
Track.hasMany(TrackReactivation, { as: 'reactivations', foreignKey: 'track_id' })
TrackReactivation.belongsTo(Track, { as: 'track', foreignKey: 'track_id' })
LeagueSeason.hasMany(TrackReactivation, { as: 'trackReactivations', foreignKey: 'league_season_id' })
TrackReactivation.belongsTo(LeagueSeason, { as: 'leagueSeason', foreignKey: 'league_season_id' })
TrackReactivation.belongsTo(Pick, { as: 'waivedPick', foreignKey: 'waived_pick_id' })
TrackReactivation.belongsTo(AdminAuditOperation, { as: 'auditOperation', foreignKey: 'admin_audit_operation_id' })
User.hasMany(BuybackDecision, { as: 'buybackDecisions', foreignKey: 'user_id' })
BuybackDecision.belongsTo(User, { as: 'user', foreignKey: 'user_id' })
LeagueSeason.hasMany(BuybackDecision, { as: 'buybackDecisions', foreignKey: 'league_season_id' })
BuybackDecision.belongsTo(LeagueSeason, { as: 'leagueSeason', foreignKey: 'league_season_id' })
BuybackDecision.hasMany(BuybackDecisionTrack, { as: 'tracks', foreignKey: 'buyback_decision_id' })
BuybackDecisionTrack.belongsTo(BuybackDecision, { as: 'decision', foreignKey: 'buyback_decision_id' })
BuybackDecisionTrack.belongsTo(Track, { as: 'track', foreignKey: 'track_id' })
BuybackDecisionTrack.belongsTo(Pick, { as: 'weekOnePick', foreignKey: 'week_one_pick_id' })
BuybackDecisionTrack.belongsTo(TrackReactivation, { as: 'reactivation', foreignKey: 'track_reactivation_id' })
BuybackDecision.belongsTo(AdminAuditOperation, { as: 'auditOperation', foreignKey: 'admin_audit_operation_id' })
User.hasMany(UserFeatureEntitlement, { as: 'featureEntitlements', foreignKey: 'user_id' })
UserFeatureEntitlement.belongsTo(User, { as: 'user', foreignKey: 'user_id' })
FeatureRelease.hasMany(UserFeatureEntitlement, { as: 'entitlements', foreignKey: 'feature_key' })
UserFeatureEntitlement.belongsTo(FeatureRelease, { as: 'feature', foreignKey: 'feature_key' })
User.hasMany(UserFeatureAccessState, { as: 'featureAccessStates', foreignKey: 'user_id' })
UserFeatureAccessState.belongsTo(User, { as: 'user', foreignKey: 'user_id' })
FeatureRelease.hasMany(UserFeatureAccessState, { as: 'accessStates', foreignKey: 'feature_key' })
UserFeatureAccessState.belongsTo(FeatureRelease, { as: 'feature', foreignKey: 'feature_key' })
AdminAuditOperation.hasMany(FeatureAdminAuditTarget, { as: 'featureTargets', foreignKey: 'admin_audit_operation_id' })
FeatureAdminAuditTarget.belongsTo(AdminAuditOperation, { as: 'operation', foreignKey: 'admin_audit_operation_id' })
User.hasOne(ReminderPreference, { as: 'reminderPreference', foreignKey: 'user_id' })
ReminderPreference.belongsTo(User, { as: 'user', foreignKey: 'user_id' })
LeagueSeason.hasMany(ReminderCampaign, { as: 'reminderCampaigns', foreignKey: 'league_season_id' })
ReminderCampaign.belongsTo(LeagueSeason, { as: 'leagueSeason', foreignKey: 'league_season_id' })
ReminderCampaign.hasMany(ReminderDelivery, { as: 'deliveries', foreignKey: 'reminder_campaign_id' })
ReminderDelivery.belongsTo(ReminderCampaign, { as: 'campaign', foreignKey: 'reminder_campaign_id' })
User.hasMany(ReminderDelivery, { as: 'reminderDeliveries', foreignKey: 'user_id' })
ReminderDelivery.belongsTo(User, { as: 'user', foreignKey: 'user_id' })
ReminderCampaign.belongsTo(AdminAuditOperation, { as: 'auditOperation', foreignKey: 'admin_audit_operation_id' })
User.hasMany(PushSubscription, { as: 'pushSubscriptions', foreignKey: 'user_id' })
PushSubscription.belongsTo(User, { as: 'user', foreignKey: 'user_id' })
ReminderDelivery.hasMany(PushDeviceDelivery, { as: 'pushDeviceDeliveries', foreignKey: 'reminder_delivery_id' })
PushDeviceDelivery.belongsTo(ReminderDelivery, { as: 'delivery', foreignKey: 'reminder_delivery_id' })
PushSubscription.hasMany(PushDeviceDelivery, { as: 'deliveries', foreignKey: 'push_subscription_id' })
PushDeviceDelivery.belongsTo(PushSubscription, { as: 'subscription', foreignKey: 'push_subscription_id' })
User.hasOne(EmailReminderVerification, { as: 'emailReminderVerification', foreignKey: 'user_id' })
EmailReminderVerification.belongsTo(User, { as: 'user', foreignKey: 'user_id' })
User.hasMany(EmailVerificationRequest, { as: 'emailVerificationRequests', foreignKey: 'user_id' })
EmailVerificationRequest.belongsTo(User, { as: 'user', foreignKey: 'user_id' })
User.hasMany(EmailOptOutToken, { as: 'emailOptOutTokens', foreignKey: 'user_id' })
EmailOptOutToken.belongsTo(User, { as: 'user', foreignKey: 'user_id' })
LeagueSeason.hasMany(CalendarEvent, { as: 'calendarEvents', foreignKey: 'league_season_id' })
CalendarEvent.belongsTo(LeagueSeason, { as: 'leagueSeason', foreignKey: 'league_season_id' })


module.exports = {
    User,
    Track,
    Team,
    LeagueSeason,
    Pick,
    ScheduleSnapshot,
    LeagueWeekOperation,
    AdminActionPreview,
    AdminAuditOperation,
    AdminAuditTarget,
    OfficialGameResultOverride,
    TrackReactivation,
    BuybackDecision,
    BuybackDecisionTrack,
    FeatureRelease,
    UserFeatureEntitlement,
    UserFeatureAccessState,
    FeatureAdminAuditTarget,
    ReminderPreference,
    ReminderCampaign,
    ReminderDelivery,
    PushSubscription,
    PushDeviceDelivery,
    EmailReminderVerification,
    EmailVerificationRequest,
    EmailOptOutToken,
    EmailProviderHealth,
    CalendarEvent,
    CalendarFeedState
};
