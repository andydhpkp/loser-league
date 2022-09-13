const router = require('express').Router()
const { Team } = require('../../models')

router.get('/', (req, res) => {
    Team.findAll({})
    .then(dbTeam => {
        res.json(dbTeam)
    })
    .catch(err => {
        console.log(err)
        res.status(500).json(err)
    })
})

router.get('/:id', (req, res) => {
    Team.findOne({
        where: {
            id: req.params.id
        }
    })
    .then(dbTeam => {
        if(!dbTeam) {
            res.status(404).json({ message: 'No Team found with this id' })
            return
        }
        res.json(dbTeam)
    })
    .catch(err => {
        console.log(err)
        res.status(500).json(err)
    })
})

//get by team name
router.get('/team/:team_name', (req, res) => {
    Team.findOne({
        where: {
            team_name: req.params.team_name
        }
    })
    .then(dbTeam => {
        if(!dbTeam) {
            res.status(404).json({ message: 'No team found with this teamname' })
            return
        }
        res.json(dbTeam)
    })
    .catch(err => {
        console.log(err)
        res.status(500).json(err)
    })
})


//Create new Team
router.post('/', (req, res) => {
    Team.create({
        team_name: req.body.team_name,
        team_logo: req.body.team_logo,
        team_record: req.body.team_record,
    })
    .then(dbTeam => {
            res.json(dbTeam)
    })
    .catch(err => {
        console.log(err)
        res.status(500).json(err)
    })
})

//update win/loss
router.put('/:id', (req, res) => {
    Team.update(req.body, {
        where: {
            id: req.params.id
        }
    })
    .then(dbTeam => {
        if (!dbTeam) {
            res.status(404).json({ message: 'No Team found with this id' })
            return
        }
        res.json(dbTeam)
    })
    .catch(err => {
        console.log(err)
        res.status(500).json(err)
    })
})

//update win/loss by name
router.put('/team/:team_name', (req, res) => {
    Team.update(req.body, {
        where: {
            team_name: req.params.team_name
        }
    })
    .then(dbTeam => {
        if (!dbTeam) {
            res.status(404).json({ message: 'No Team found with this id' })
            return
        }
        res.json(dbTeam)
    })
    .catch(err => {
        console.log(err)
        res.status(500).json(err)
    })
})

//delete
router.delete('/:id', (req, res) => {
    Team.destroy({
        where: {
            id: req.params.id
        }
    })
    .then(dbTeam => {
        if (!dbTeam) {
            res.status(404).json({ message: 'No Team found with this id' })
            return
        }
        res.json(dbTeam)
    })
    .catch(err => {
        console.log(err)
        res.status(500).json(err)
    })
})

router.delete('/', (req, res) => {
    Team.destroy({
        where: {},
        truncate: true
    })
    .then(dbTeam => {
        if (!dbTeam) {
            res.status(404).json({ message: 'All teams deleted' })
            return
        }
        res.json(dbTeam)
    })
    .catch(err => {
        console.log(err)
        res.status(500).json(err)
    })
})


module.exports = router;