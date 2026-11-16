const app = require('./app');
const http = require('node:http');
const { once } = require('node:events');
const { setTimeout: wait } = require('node:timers/promises');
const { sequelize, isConnectionLimit } = require('./database');
const { configureFrontend } = require('./frontend');
const { resumeConversions } = require('./modules/courses/video');
const { initialize } = require('../scripts/init-db');
const port = Number(process.env.PORT) || 3000;
const server = http.createServer(app);

async function serve() {
    await configureFrontend(server, process.argv.includes('--dev'));
    server.listen(port, '127.0.0.1');
    await once(server, 'listening');
}

async function start() {
    for (;;) {
        try {
            if (server.listening) {
                app.locals.dbRetrySeconds = 3;
                app.locals.dbStartupMessage = 'DB 연결을 다시 확인하고 있습니다.';
            }
            await sequelize.authenticate();
            if (server.listening)
                app.locals.dbStartupMessage =
                    'DB에 연결했습니다. 사이트 데이터를 준비하고 있습니다.';
            await initialize();
            await resumeConversions();
            break;
        } catch (error) {
            if (!isConnectionLimit(error)) throw error;
            app.locals.dbStartupMessage = undefined;
            app.locals.dbRetrySeconds = 20;
            if (!server.listening) {
                await serve();
                console.warn(
                    `MathSite: http://localhost:${port} (DB 접속 한도 대기, 20초마다 재시도)`,
                );
            }
            await wait(app.locals.dbRetrySeconds * 1000);
        }
    }
    app.locals.dbRetrySeconds = 0;
    app.locals.dbStartupMessage = undefined;
    if (!server.listening) await serve();
    console.log(`MathSite: http://localhost:${port} (MySQL 연결 완료)`);
}

start().catch(async (error) => {
    if (error.code === 'EADDRINUSE')
        console.error(
            `${port}번 포트가 이미 사용 중입니다. MathSite가 실행 중이라면 해당 터미널에서 Ctrl+C로 종료한 뒤 새 터미널에서 다시 실행하세요.`,
        );
    else
        console.error(
            '서버 시작 실패: DB 연결과 프론트 설정을 확인하세요.',
            error.original?.code || error.code || error.name,
        );
    process.exitCode = 1;
    server.close();
    server.closeAllConnections();
    await sequelize.close();
});
