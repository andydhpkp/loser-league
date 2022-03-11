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

router.get('/:id', (req, res) => {
    User.findOne({
        attributes: { exclude: ['master_password'] },
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

//register new user
router.post('/', (req, res) => {
    User.create({
        first_name: req.body.first_name,
        last_name: req.body.last_name,
        username: req.body.username,
        email: req.body.email,
        master_password: req.body.master_password
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
            email: req.body.email
        }
    }).then(dbUser => {
        if(!dbUser) {
            res.status(400).json({ message: 'No user with that username' })
            return
        }

        //use User model's password validator
        const validPassword = dbUser.checkPassword(req.body.master_password);

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

module.exports = router;