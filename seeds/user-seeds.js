const { User } = require('../models');

const userData = [
    {
        first_name: 'Bob',
        last_name: 'Cauldlow',
        email: 'robert.california@gmail.com',
        master_password: 'RobertandMary1958!'
    },
    {
        first_name: 'Marge',
        last_name: 'Little',
        email: 'luvmygrandkids4@gmail.com',
        master_password: 'TheWholeF@m1997'
    },
    {
        first_name: 'Don',
        last_name: 'Daniels',
        email: 'farmerdon@gmail.com',
        master_password: 'BlessThisCountry45.'
    }
]

const seedUsers = () => User.bulkCreate(userData, {individualHooks: true});

module.exports = seedUsers;