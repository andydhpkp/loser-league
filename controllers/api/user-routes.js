const router = require('express').Router()
const { User } = require('../../models')

router.get('/', (req, res) => {
    User.findAll({
        attributes: { exclude: ['master_password'] }
    })
    .then(dbUser => {
        res.json(dbUser)
    })
    .catch(err => {
        console.log(err)
        res.status(500).json(err)
    })
})