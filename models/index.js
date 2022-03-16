//going to need to do a belongs to for future model of picks
const User = require('./User')
const Track = require('./Track')

User.hasMany(Track, {
    foreignKey: 'user_id'
})

Track.belongsTo(User, {
    foreignKey: 'user_id',
    onDelete: 'SET NULL'
})


module.exports = { User, Track };