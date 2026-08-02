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
    TrackReactivation
};
