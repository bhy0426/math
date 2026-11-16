const { sequelize } = require('./database');

async function status(user) {
    await sequelize.authenticate();
    return {
        service: 'MathSite 백엔드',
        server: '실행 중',
        database: 'MySQL 연결 완료',
        loggedIn: Boolean(user),
        user: user || null,
        api: {
            로그인상태: '/api/auth/status',
            내정보: '/api/user',
            강좌: '/api/courses',
            공지: '/api/boards',
            질문답변: '/api/info/qna',
        },
    };
}

module.exports = { status };
