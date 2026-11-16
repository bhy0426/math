const express = require('express');
const path = require('node:path');
const fs = require('node:fs/promises');

const router = express.Router();
const buildDirectory = path.resolve(__dirname, '../dist/client');
const serveBuild = express.static(buildDirectory);
let vite;

// 개발 중에는 Vite, 일반 실행에서는 빌드된 React 파일을 제공한다.
router.use((req, res, next) =>
    vite ? vite.middlewares(req, res, next) : serveBuild(req, res, next),
);
router.get(
    [
        '/',
        '/login',
        '/register',
        '/reset',
        '/user',
        '/info',
        '/courses',
        '/courses/:courseId',
        '/courses/:courseId/lectures/:lectureId',
        '/boards',
        '/manager',
    ],
    async (req, res) => {
        res.set('Referrer-Policy', 'no-referrer');
        if (vite) {
            const template = await fs.readFile(
                path.resolve(__dirname, '../client/index.html'),
                'utf8',
            );
            return res.type('html').send(await vite.transformIndexHtml(req.originalUrl, template));
        }
        res.sendFile(path.join(buildDirectory, 'index.html'));
    },
);

async function configureFrontend(server, development) {
    if (!development) return;
    const { createServer } = await import('vite');
    vite = await createServer({
        configFile: path.resolve(__dirname, '../vite.config.mjs'),
        server: { middlewareMode: true, hmr: { server } },
        appType: 'custom',
    });
    server.on('close', () => vite.close());
}

module.exports = { router, configureFrontend };
