const app = require('./app');
const { query } = require('./database');
const port = Number(process.env.PORT) || 3000;

query('SELECT 1')
    .then(() => {
        app.listen(port, '127.0.0.1', () =>
            console.log(`MathSite: http://localhost:${port} (MySQL 연결 완료)`),
        );
    })
    .catch(() => {
        console.error('MySQL 연결 실패: DB 실행 상태와 .env를 확인하세요.');
        process.exitCode = 1;
    });
