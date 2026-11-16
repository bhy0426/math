const router = require('express').Router();
const { requireLogin, requireAdmin } = require('../../shared/helpers');
const service = require('./service');

router.use(requireLogin);
router.get('/qna', async (req, res) => res.json(await service.list(req.user)));
router.post('/qna', async (req, res) =>
    res.status(201).json(await service.create(req.body, req.user)),
);
router.get('/qna/:questionId', async (req, res) =>
    res.json(await service.detail(req.params.questionId, req.user)),
);
router.patch('/qna/:questionId', async (req, res) =>
    res.json(await service.edit(req.params.questionId, req.body, req.user)),
);
router.delete('/qna/:questionId', async (req, res) =>
    res.json(await service.remove(req.params.questionId, req.user)),
);
router.post('/qna/:questionId/answer', requireAdmin, async (req, res) =>
    res.status(201).json(await service.answer(req.params.questionId, req.body, req.user, 'create')),
);
router.patch('/qna/:questionId/answer', requireAdmin, async (req, res) =>
    res.json(await service.answer(req.params.questionId, req.body, req.user, 'edit')),
);
router.delete('/qna/:questionId/answer', requireAdmin, async (req, res) =>
    res.json(await service.answer(req.params.questionId, req.body, req.user, 'remove')),
);

module.exports = router;
