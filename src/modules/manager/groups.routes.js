const router = require('express').Router();
const service = require('./groups.service');

router.get('/', async (req, res) => res.json(await service.list()));
router.post('/', async (req, res) => res.status(201).json(await service.create(req.body)));
router.patch('/:groupId', async (req, res) =>
    res.json(await service.rename(req.params.groupId, req.body)),
);
router.delete('/:groupId', async (req, res) => res.json(await service.remove(req.params.groupId)));
router.patch('/:groupId/members', async (req, res) =>
    res.json(await service.editMembers(req.params.groupId, req.body)),
);
router.post('/:groupId/access', async (req, res) =>
    res.json(await service.editAccess(req.params.groupId, req.body, req.user.id)),
);

module.exports = router;
