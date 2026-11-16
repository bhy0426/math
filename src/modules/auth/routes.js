const router = require('express').Router();
const service = require('./service');
const signup = require('./register.service');
const fields = require('../manager/member-fields.service');

router.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    next();
});

router.get('/status', (req, res) => res.json(service.status(req.user)));
router.get('/fields', async (req, res) => res.json(await fields.publicConfiguration()));
router.post('/register/code', async (req, res) =>
    res.json(await signup.requestCode(req, req.body)),
);
router.post('/register', async (req, res) =>
    res.status(201).json(await signup.register(req, req.body)),
);
router.post('/login', async (req, res) => res.json(await service.login(req, req.body)));
router.post('/logout', async (req, res) => {
    const result = await service.logout(req);
    res.clearCookie('mathsite.sid');
    res.json(result);
});
router.get('/reset/status', async (req, res) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    res.json(await service.recoveryStatus(req));
});
router.post('/reset', async (req, res) => res.json(await service.reset(req.body, req)));

module.exports = router;
