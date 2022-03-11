const seedUsers = require('./user-seeds');
const seedPicks = require('./pick-seeds');
const seedTracks = require('./track-seeds')

const sequelize = require('../config/connection');
const { User, Pick, Track } = require('../models');

const seedAll = async () => {
    await sequelize.sync({force: true});
    console.log('\n---- Database Synced ----\n')

    await seedUsers();
    console.log('\n---- Users Seeded ----\n')

    await seedTracks();
    console.log('\n---- Tracks Seeded ----\n')

    await seedPicks();
    console.log('\n---- Picks Seeded ----\n')

    process.exit(0);
}

seedAll();
