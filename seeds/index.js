const seedUsers = require('./user-seeds');

const sequelize = require('../config/connection');
const { User } = require('../models');



const seedAll = async () => {
    await sequelize.sync({force: true});
    console.log('\n---- Database Synced ----\n')

    await seedUsers();
    console.log('\n---- Users Seeded ----\n')

    process.exit(0);
}

seedAll();
