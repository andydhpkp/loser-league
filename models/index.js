//going to need to do a belongs to for future model of picks
const User = require('./User')
const Pick = require('./Pick')
const Track = require('./Track')

User.hasMany(Pick, {
    foreignKey: 'user_id'
})

Track.belongsTo(User, {
    foreignKey: 'user_id',
    onDelete: 'SET NULL'
})

Track.hasMany(Pick, {
    foreignKey: 'track_id',
})

Pick.belongsTo(Track, {
    foreignKey: 'track_id',
    onDelete: 'SET NULL'
})

module.exports = { User, Pick, Track };