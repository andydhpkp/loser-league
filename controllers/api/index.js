const router = require('express').Router()

const userRoutes = require('./user-routes.js')
const trackRoutes = require('./tracks-routes.js')

router.use('/users', userRoutes)
router.use('/tracks', trackRoutes)

module.exports = router