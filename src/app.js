const express = require('express');
const session = require('express-session');
const health = require('./health');
const { isConnectionLimit } = require('./database');
const { currentUser, sameOrigin } = require('./middleware/session-user');
const createSocialRouter = require('./modules/auth/social.routes');

const app = express();
app.set('json spaces', 2);
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
    req.body ||= {};
    next();
});
app.use(
    session({
        name: 'mathsite.sid',
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 4 * 60 * 60 * 1000 },
    }),
);

function dbBusy(
    res,
    seconds,
    message = 'DB 동시 접속 한도가 찼습니다. 사용하지 않는 DB 연결을 닫고 다시 시도하세요.',
) {
    return res
        .set({ 'Retry-After': String(seconds), 'Cache-Control': 'no-store' })
        .status(503)
        .json({ message });
}

// DB 준비가 끝나기 전에는 보호된 요청을 처리하지 않는다. React 파일은 계속 제공한다.
app.use(['/api', '/auth/kakao', '/auth/google', '/health'], (req, res, next) => {
    if (app.locals.dbRetrySeconds)
        return dbBusy(res, app.locals.dbRetrySeconds, app.locals.dbStartupMessage);
    return currentUser(req, res, next);
});
app.use(sameOrigin);

app.get('/health', async (req, res) => res.json(await health.status(req.user)));

app.use(
    ['/auth/kakao', '/api/auth/kakao'],
    createSocialRouter(require('./modules/auth/kakao.service')),
);
app.use(
    ['/auth/google', '/api/auth/google'],
    createSocialRouter(require('./modules/auth/google.service')),
);
app.use('/api/auth', require('./modules/auth/routes'));
app.use('/api/user', require('./modules/user/routes'));
app.use('/api/manager', require('./modules/manager/routes'));
app.use('/api/info', require('./modules/info/routes'));
app.use('/api/courses', require('./modules/courses/routes'));
app.use('/api/boards', require('./modules/boards/routes'));

// API는 JSON으로, 화면은 React로 응답한다.
app.use('/api', (req, res) => res.status(404).json({ message: '등록되지 않은 API입니다.' }));
app.use(require('./frontend').router);

app.use((req, res) => res.status(404).json({ message: '등록되지 않은 API입니다.' }));

app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (isConnectionLimit(error)) return dbBusy(res, 10);
    if (error.name === 'SequelizeUniqueConstraintError')
        return res.status(409).json({ message: '이미 사용 중인 값입니다.' });
    if (error.name === 'SequelizeForeignKeyConstraintError')
        return res.status(409).json({ message: '사용 중인 데이터는 삭제할 수 없습니다.' });
    if (error.name === 'SequelizeValidationError')
        return res.status(400).json({ message: '입력 형식을 확인하세요.' });
    if (error.code === 'ER_DUP_ENTRY')
        return res.status(409).json({ message: '이미 등록된 값입니다.' });
    if (error.code === 'ER_ROW_IS_REFERENCED_2')
        return res.status(409).json({ message: '사용 중인 데이터는 삭제할 수 없습니다.' });
    if (error.code === 'LIMIT_FILE_SIZE')
        return res.status(413).json({ message: '영상은 250MB 이하만 업로드할 수 있습니다.' });
    const status = error.status || (error.name === 'MulterError' ? 400 : 500);
    if (status >= 500) console.error('요청 처리 실패:', error.code || error.name);
    res.status(status).json({
        message:
            status < 500 || error.expose === true
                ? error.message
                : '서버 또는 DB 처리 중 오류가 발생했습니다.',
    });
});

module.exports = app;
