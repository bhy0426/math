const router = require('express').Router();
const { requireAdmin } = require('../../shared/helpers');
const service = require('./service');
const roles = require('./roles.service');
const access = require('./lecture-access.service');
const { requestAdminReset } = require('../auth/service');
const fields = require('../user/member-fields.service');
const settings = require('./member-settings.service');

router.use(requireAdmin);
router.use(['/mail', '/broadcasts'], async (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    await fields.requireEmailFields();
    next();
});
router.use('/groups', require('./groups.routes'));
router.use('/broadcasts', require('./broadcast.routes'));
router.use('/mail', require('../mail/routes'));
router.get('/member-fields', async (req, res) => res.json({ fields: await fields.listFields() }));
router.patch('/member-fields', async (req, res) => res.json(await settings.editFields(req.body)));
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
    res.json(await requestAdminReset(req.params.userId)),
);

router.get('/', async (req, res) => res.json(await roles.listRoles()));
router.post('/', async (req, res) => res.status(201).json(await roles.createRole(req.body)));
router.patch('/', async (req, res) => res.json(await roles.editRole(req.body)));
router.delete('/', async (req, res) => res.json(await roles.removeRole(req.body)));

router.get('/users/:userId/lectures', async (req, res) =>
    res.json(await access.listAccess(req.params.userId)),
);
router.post('/users/:userId/lectures', async (req, res) =>
    res.status(201).json(await access.grantAccess(req.params.userId, req.body, req.user.id)),
);
router.delete('/users/:userId/lectures/:lectureId', async (req, res) =>
    res.json(await access.revokeAccess(req.params.userId, req.params.lectureId)),
);

module.exports = router;
