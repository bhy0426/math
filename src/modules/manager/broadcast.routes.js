const router = require('express').Router();
const service = require('./broadcast.service');

router.get('/recipients', async (req, res) =>
    res.json(await service.recipients(req.query.groupId)),
);
router.get('/:requestId', async (req, res) =>
    res.json(await service.receipt(req.user.id, req.params.requestId)),
);
router.post('/', async (req, res) => {
    const result = await service.submit(req.user.id, req.body);
    res.status(result.status === 'sending' ? 202 : 200).json(result);
});

module.exports = router;
