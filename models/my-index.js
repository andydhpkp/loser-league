//going to need to do a belongs to for future model of picks
const User = require('./User')
const Track = require('./Track')
const Team = require('./Team')
const LeagueSeason = require('./LeagueSeason')
const Pick = require('./Pick')
const ScheduleSnapshot = require('./ScheduleSnapshot')
const LeagueWeekOperation = require('./LeagueWeekOperation')

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


module.exports = {
    User,
    Track,
    Team,
    LeagueSeason,
    Pick,
    ScheduleSnapshot,
    LeagueWeekOperation
};
