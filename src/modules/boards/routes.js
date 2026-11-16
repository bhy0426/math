const router = require('express').Router();
const { requireLogin, requireAdmin } = require('../../shared/helpers');
const service = require('./service');

router.use(requireLogin);
router.get('/', async (req, res) => res.json(await service.list(req.query)));
router.get('/popup', async (req, res) => res.json(await service.popup()));
router.post('/', requireAdmin, async (req, res) =>
    res.status(201).json(await service.create(req.body, req.user.id)),
);
router.get('/:boardId', async (req, res) => res.json(await service.detail(req.params.boardId)));
router.patch('/:boardId', requireAdmin, async (req, res) =>
    res.json(await service.edit(req.params.boardId, req.body)),
);
router.delete('/:boardId', requireAdmin, async (req, res) =>
    res.json(await service.remove(req.params.boardId)),
);
router.patch('/:boardId/pin', requireAdmin, async (req, res) =>
    res.json(await service.pin(req.params.boardId, req.body)),
);

module.exports = router;
