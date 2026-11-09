const express = require('express');
const controller = require('./kakao.controller');
const { requireLogin } = require('../../shared/helpers');
const router = express.Router();

router.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    next();
});
router.get('/status', controller.status);
router.get('/', controller.start);
router.get('/link', requireLogin, controller.start);
router.get('/callback', controller.callback);
router.post('/register', controller.register);

module.exports = router;
