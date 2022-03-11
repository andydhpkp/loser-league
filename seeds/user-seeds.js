const { User } = require('../models');

const userData = [
    {
        first_name: 'Bob',
        last_name: 'Cauldlow',
        username: 'bobybob',
        email: 'robert.california@gmail.com',
        password: 'RobertandMary1958!'
    },
    {
        first_name: 'Marge',
        last_name: 'Little',
        username: 'lilmama',
        email: 'luvmygrandkids4@gmail.com',
        password: 'TheWholeF@m1997'
    },
    {
        first_name: 'Don',
        last_name: 'Daniels',
        username: 'doubledon',
        email: 'farmerdon@gmail.com',
        password: 'BlessThisCountry45.'
    }
]

const seedUsers = () => User.bulkCreate(userData, {individualHooks: true});

module.exports = seedUsers;