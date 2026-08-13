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
    FeatureAdminAuditTarget
};
