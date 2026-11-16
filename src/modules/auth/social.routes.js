const { Router } = require('express');
const { requireLogin } = require('../../shared/helpers');

// 카카오와 구글은 같은 HTTP 경로를 사용한다. 연결할 로그인 서비스만 다르다.
module.exports = function createSocialRouter(service) {
    const router = Router();
    router.use((req, res, next) => {
        res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
        next();
    });
    router.get('/status', async (req, res) => res.json(await service.status(req)));
    router.get('/', async (req, res) => res.redirect(303, await service.start(req)));
    router.get('/link', requireLogin, async (req, res) =>
        res.redirect(303, await service.start(req)),
    );
    router.get('/recover', async (req, res) => res.redirect(303, await service.start(req)));
    router.get('/callback', async (req, res) => res.redirect(303, await service.callback(req)));
    router.post('/register', async (req, res) =>
        res.status(201).json(await service.register(req, req.body)),
    );
    return router;
};
