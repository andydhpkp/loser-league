const router = require('express').Router()
const { User, Track } = require('../../models')

router.get('/', (req, res) => {
    User.findAll({
        //attributes: { exclude: ['password'] }
            include: [
            {
                model: Track
            }
        ]
    })
    .then(dbUser => {
        res.json(dbUser)
    })
    .catch(err => {
        console.log(err)
        res.status(500).json(err)
    })
})

router.get('/:id', (req, res) => {
    User.findOne({
        attributes: { exclude: ['password'] },
        where: {
            id: req.params.id
        },
/*         include: [
            {
                model: Credential,
                attributes: ['id', 'nickname', 'login_name', 'password', 'user_id']
            }
        ] */
    })
    .then(dbUser => {
        if(!dbUser) {
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

//get by username
router.get('/username/:username', (req, res) => {
    User.findOne({
        where: {
            username: req.params.username
        },
        include: [
            {
                model: Track
            }
        ]
    })
    .then(dbUser => {
        if(!dbUser) {
            res.status(404).json({ message: 'No user found with this username' })
            return
        }
        res.json(dbUser)
    })
    .catch(err => {
        console.log(err)
        res.status(500).json(err)
    })
})

//register new user
router.post('/', (req, res) => {
    User.create({
        first_name: req.body.first_name,
        last_name: req.body.last_name,
        username: req.body.username,
        email: req.body.email,
        password: req.body.password
    })
    .then(dbUser => {
        req.session.save(() => {
            req.session.user_id = dbUser.id;
            req.session.loggedIn = true;

            res.json(dbUser)
        })
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

//get logged in id
router.get('/logged', (req, res) => {
    User.findOne({
        where: {
            id: req.session.user_id
        }
    }).then(dbUser => {
        if(!dbUser) {
            res.status(400).json({ message: 'did not work'})
            return
        }
        res.json(dbUser)
    }).catch(err => {
        console.log(err)
        res.status(500).json(err)
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

//delete by username
router.delete('/username/:username', (req, res) => {
    User.destroy({
        where: {
            username: req.params.username
        }
    })
    .then(dbUser => {
        if (!dbUser) {
            res.status(404).json({ message: 'No user found with this username' })
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