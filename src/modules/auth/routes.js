const express = require('express');
const controller = require('./controller');
const router = express.Router();

router.get('/status', controller.status);
router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/logout', controller.logout);
router.post('/reset', controller.reset);

module.exports = router;
