const express = require('express');
const session = require('express-session');
const path = require('node:path');
const { query } = require('./database');
const { currentUser, sameOrigin } = require('./middleware/session-user');

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

// Lax 쿠키는 카카오에서 돌아오는 최상위 GET callback에도 전달된다.
app.use(currentUser);
app.use(sameOrigin);

// 화면 주소와 JSON API 주소를 분리한다.
for (const [url, file] of Object.entries({
    '/': 'home/index',
    '/login': 'auth/login',
    '/user': 'user/user',
    '/info': 'info/info',
    '/courses': 'courses/courses',
    '/courses/:courseId': 'courses/course',
    '/courses/:courseId/lectures/:lectureId': 'courses/lecture',
    '/boards': 'boards/boards',
    '/manager': 'manager/manager',
}))
    app.get(url, (req, res) => res.sendFile(path.join(__dirname, `../public/pages/${file}.html`)));
app.use('/static', express.static(path.join(__dirname, '../public'), { index: false }));

app.get('/health', async (req, res) => {
    await query('SELECT 1');
    res.json({
        service: 'MathSite 백엔드',
        server: '실행 중',
        database: 'MySQL 연결 완료',
        loggedIn: Boolean(req.user),
        user: req.user || null,
        api: {
            로그인상태: '/api/auth/status',
            내정보: '/api/user',
            강좌: '/api/courses',
            공지: '/api/boards',
            질문답변: '/api/info/qna',
        },
    });
});

app.use('/auth/kakao', require('./modules/auth/kakao.routes'));
app.use('/api/auth/kakao', require('./modules/auth/kakao.routes'));
app.use('/api/auth', require('./modules/auth/routes'));
app.use('/api/user', require('./modules/user/routes'));
app.use('/api/manager', require('./modules/manager/routes'));
app.use('/api/info', require('./modules/info/routes'));
app.use('/api/courses', require('./modules/courses/routes'));
app.use('/api/boards', require('./modules/boards/routes'));

app.use((req, res) => res.status(404).json({ message: '등록되지 않은 API입니다.' }));

app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.code === 'ER_DUP_ENTRY')
        return res.status(409).json({ message: '이미 등록된 값입니다.' });
    if (error.code === 'ER_ROW_IS_REFERENCED_2')
        return res.status(409).json({ message: '사용 중인 데이터는 삭제할 수 없습니다.' });
    if (error.code === 'LIMIT_FILE_SIZE')
        return res.status(413).json({ message: '영상은 250MB 이하만 업로드할 수 있습니다.' });
    const status = error.status || (error.name === 'MulterError' ? 400 : 500);
    res.status(status).json({
        message: status < 500 ? error.message : '서버 또는 DB 처리 중 오류가 발생했습니다.',
    });
});

module.exports = app;
