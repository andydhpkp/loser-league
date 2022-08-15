const router = require('express').Router()

const userRoutes = require('./user-routes.js')
const trackRoutes = require('./tracks-routes.js')
const teamRoutes = require('./team-routes.js')

router.use('/users', userRoutes)
router.use('/tracks', trackRoutes)
router.use('/teams', teamRoutes)

module.exports = router