const router = require('express').Router();
const { requireLogin } = require('../../shared/helpers');
const service = require('./kakao.service');

router.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    next();
});
router.get('/status', async (req, res) => res.json(await service.status(req)));
router.get('/', async (req, res) => res.redirect(303, await service.start(req)));
router.get('/link', requireLogin, async (req, res) => res.redirect(303, await service.start(req)));
router.get('/recover', async (req, res) => res.redirect(303, await service.start(req)));
router.get('/callback', async (req, res) => res.redirect(303, await service.callback(req)));
router.post('/register', async (req, res) =>
    res.status(201).json(await service.register(req, req.body)),
);

module.exports = router;
