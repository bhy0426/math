const router = require('express').Router();
const { requireAdmin } = require('../../shared/helpers');
const service = require('./service');
const fields = require('./member-fields.service');

router.use(requireAdmin);
router.get('/member-fields', async (req, res) => res.json({ fields: await fields.listFields() }));
router.patch('/member-fields', async (req, res) => res.json(await fields.editFields(req.body)));
router.get('/users', async (req, res) => res.json(await service.listUsers()));
router.get('/users/:userId', async (req, res) =>
    res.json({ user: await service.getUser(req.params.userId) }),
);
router.patch('/users/:userId', async (req, res) =>
    res.json(await service.editUser(req.params.userId, req.body)),
);
router.get('/users/:userId/role', async (req, res) =>
    res.json(await service.userRole(req.params.userId)),
);
router.patch('/users/:userId/role', async (req, res) =>
    res.json(await service.changeRole(req.params.userId, req.body)),
);
router.patch('/users/:userId/status', async (req, res) =>
    res.json(await service.changeStatus(req.params.userId, req.body)),
);
router.delete('/users/:userId', async (req, res) =>
    res.json(await service.removeUser(req.params.userId)),
);
router.post('/users/:userId/password-reset', async (req, res) =>
    res.json(await service.requestAdminReset(req.params.userId)),
);

router.get('/', async (req, res) => res.json(await service.listRoles()));
router.post('/', async (req, res) => res.status(201).json(await service.createRole(req.body)));
router.patch('/', async (req, res) => res.json(await service.editRole(req.body)));
router.delete('/', async (req, res) => res.json(await service.removeRole(req.body)));

router.get('/users/:userId/lectures', async (req, res) =>
    res.json(await service.listAccess(req.params.userId)),
);
router.post('/users/:userId/lectures', async (req, res) =>
    res.status(201).json(await service.grantAccess(req.params.userId, req.body, req.user.id)),
);
router.delete('/users/:userId/lectures/:lectureId', async (req, res) =>
    res.json(await service.revokeAccess(req.params.userId, req.params.lectureId)),
);

module.exports = router;
