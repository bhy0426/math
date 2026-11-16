const router = require('express').Router();
const { requireLogin, requireAdmin } = require('../../shared/helpers');
const service = require('./service');

router.use(requireLogin);
router.use('/:courseId/lectures', require('./lectures.routes'));
router.get('/', async (req, res) => res.json(await service.list(req.query, req.user)));
router.post('/', requireAdmin, async (req, res) =>
    res.status(201).json(await service.create(req.body)),
);
router.get('/:courseId', async (req, res) =>
    res.json(await service.detail(req.params.courseId, req.user)),
);
router.patch('/:courseId', requireAdmin, async (req, res) =>
    res.json(await service.edit(req.params.courseId, req.body, req.user)),
);
router.delete('/:courseId', requireAdmin, async (req, res) =>
    res.json(await service.remove(req.params.courseId, req.user)),
);
router.patch('/:courseId/status', requireAdmin, async (req, res) =>
    res.json(await service.changeStatus(req.params.courseId, req.body, req.user)),
);

module.exports = router;
