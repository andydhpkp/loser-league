const { Pick } = require('../models')

const pickData = [
    {
        picked_team: "49ers",
        track_id: 1,
    },
    {
        picked_team: "Cardinals",
        track_id: 2,
    },
    {
        picked_team: "Eagles",
        track_id: 3,
    },
]

const seedPick = () => Pick.bulkCreate(pickData);

module.exports = seedPick;