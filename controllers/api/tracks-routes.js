const router = require('express').Router()
const { Track, User } = require('../../models')

router.get('/', (req, res) => {
    Track.findAll({
        include: [
            {
                model: User,
                attributes: ['id', 'first_name', 'last_name', 'username', 'email', 'password']
            }
        ]
    })
    .then(dbTrack => {
        res.json(dbTrack)
    })
    .catch(err => {
        console.log(err)
        res.status(500).json(err)
    })
})

router.get('/:id', (req, res) => {
    Track.findOne({
        where: {
            id: req.params.id
        },
        include: [
            {
                model: User,
                attributes: ['id', 'first_name', 'last_name', 'username', 'email', 'password']
            }
        ]
    })
    .then(dbTrack => {
        if(!dbTrack) {
            res.status(404).json({ message: 'No Track found with this id' })
            return
        }
        res.json(dbTrack)
    })
    .catch(err => {
        console.log(err)
        res.status(500).json(err)
    })
})

//Create new Track
router.post('/', (req, res) => {
    Track.create({
        available_picks: req.body.available_picks,
        used_picks: req.body.used_picks,
        current_pick: req.body.current_pick,


        //change to req.session.user_id
        user_id: req.body.user_id
    })
    .then(dbTrack => {
            res.json(dbTrack)
    })
    .catch(err => {
        console.log(err)
        res.status(500).json(err)
    })
})









//login route
router.post('/login', (req, res) => {
    User.findOne({
        where: {
            username: req.body.username,
        }
    }).then(dbUser => {
        if(!dbUser) {
            res.status(400).json({ message: 'No user with that username' })
            return
        }

        //use User model's password validator
        console.log('this is req.password ' + JSON.stringify(req.body))
        const validPassword = dbUser.checkPassword(req.body.password);

        if (!validPassword) {
            res.status(400).json({ message: 'Incorrect password!' });
            return;
        }

        req.session.save(() => {
            req.session.user_id = dbUser.id;
            req.session.username = dbUser.username;
            req.session.loggedIn = true;

            res.json({ user: dbUser, message: 'You are now logged in!' })
        })
    })
})

//logout route
router.post('/logout', (req, res) => {
    if (req.session.loggedIn) {
        req.session.destroy(() => {
            res.status(204).end()
        })
    }
    else {
        res.status(404).end()
    }
})

//update
router.put('/:id', (req, res) => {
    User.update(req.body, {
        where: {
            id: req.params.id
        }
    })
    .then(dbUser => {
        if (!dbUser) {
            res.status(404).json({ message: 'No user found with this id' })
            return
        }
        res.json(dbUser)
    })
    .catch(err => {
        console.log(err)
        res.status(500).json(err)
    })
})

//delete
router.delete('/:id', (req, res) => {
    User.destroy({
        where: {
            id: req.params.id
        }
    })
    .then(dbUser => {
        if (!dbUser) {
            res.status(404).json({ message: 'No user found with this id' })
            return
        }
        res.json(dbUser)
    })
    .catch(err => {
        console.log(err)
        res.status(500).json(err)
    })
})

module.exports = router;