const router = require('express').Router();
const service = require('./sender.service');

router.get('/', (req, res) => res.json(service.status(req.sessionID)));
router.post('/check', async (req, res) => res.json(await service.check(req.sessionID)));
router.post('/verification', async (req, res) =>
    res.json(await service.requestVerification(req.sessionID, req.body)),
);
router.post('/confirm', (req, res) => res.json(service.confirm(req.sessionID, req.body)));

module.exports = router;
