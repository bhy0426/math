const router = require('express').Router({ mergeParams: true });
const { requireAdmin } = require('../../shared/helpers');
const { upload } = require('./upload');
const service = require('./lectures.service');

router.get('/', async (req, res) =>
    res.json(await service.list(req.params.courseId, req.query, req.user)),
);
router.post('/', requireAdmin, upload.single('video'), async (req, res) =>
    res.status(201).json(await service.create(req.params.courseId, req.body, req.file, req.user)),
);
router.patch('/:lectureId', requireAdmin, upload.single('video'), async (req, res) =>
    res.json(
        await service.edit(req.params.courseId, req.params.lectureId, req.body, req.file, req.user),
    ),
);
router.delete('/:lectureId', requireAdmin, async (req, res) =>
    res.json(await service.remove(req.params.courseId, req.params.lectureId, req.user)),
);
router.post('/:lectureId/playback', async (req, res) =>
    res.json(await service.playback(req.params.courseId, req.params.lectureId, req.user)),
);
router.post('/:lectureId/convert', requireAdmin, async (req, res) =>
    res
        .status(202)
        .json(await service.convert(req.params.courseId, req.params.lectureId, req.user)),
);
router.get('/:lectureId/hls/:key/:asset', async (req, res) => {
    const result = await service.hlsFile(
        req.params.courseId,
        req.params.lectureId,
        req.params.key,
        req.params.asset,
        req.user,
    );
    res.set('Cache-Control', 'private, no-store').type(result.contentType);
    if (req.get('X-MathSite-Media-Proxy') === 'nginx')
        return res.set('X-Accel-Redirect', result.redirect).end();
    res.sendFile(result.filename, { dotfiles: 'allow' });
});
router.get('/:lectureId', async (req, res) => {
    const result = await service.original(
        req.params.courseId,
        req.params.lectureId,
        req.query.info,
        req.headers.range,
        req.user,
    );
    if (result.json) return res.json(result.json);
    res.status(result.status).set(result.headers);
    if (!result.filename) return res.end();
    const stream = service.openStream(result);
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
});

module.exports = router;
