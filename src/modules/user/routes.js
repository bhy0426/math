const router = require('express').Router();
const { requireLogin } = require('../../shared/helpers');
const service = require('./service');

router.use(requireLogin);
router.get('/', (req, res) => res.json({ user: req.user }));
router.patch('/', async (req, res) => res.json(await service.edit(req.user.id, req.body)));

module.exports = router;
