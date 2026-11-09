const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const mysql = require('mysql2/promise');
require('dotenv').config({ quiet: true });
const localEnv = path.resolve('.env.local');
if (!fs.existsSync(localEnv)) throw new Error('로컬 DB 도구는 .env.local 설정이 필요합니다.');
require('dotenv').config({ path: localEnv, override: true, quiet: true });
if (!['127.0.0.1', 'localhost'].includes(process.env.DB_HOST))
    throw new Error('로컬 DB 도구는 이 PC의 MySQL에만 연결합니다.');

async function connect(root = false) {
    const password = root
        ? require('dotenv').parse(fs.readFileSync(path.resolve('.local/mysql-admin.env')))
              .MYSQL_ROOT_PASSWORD
        : process.env.DB_PASSWORD;
    return mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        user: root ? 'root' : process.env.DB_USER,
        password,
        database: root ? undefined : process.env.DB_NAME,
    });
}

async function main() {
    const action = process.argv[2];
    if (action === 'stop') {
        const connection = await connect(true);
        try {
            const [[row]] = await connection.query('SELECT @@datadir AS directory');
            const expected = path.resolve(path.dirname(process.env.MYSQL_CONFIG), 'data');
            if (path.resolve(row.directory).toLowerCase() !== expected.toLowerCase())
                throw new Error('MathSite 전용 DB가 아니므로 중지하지 않습니다.');
            await connection.query('SHUTDOWN');
        } finally {
            await connection.end().catch(() => {});
        }
        return console.log('MathSite MySQL 중지 완료');
    }
    if (action !== 'start') throw new Error('start 또는 stop을 지정하세요.');
    try {
        const connection = await connect();
        await connection.end();
        return console.log('MathSite MySQL 실행 중');
    } catch (error) {
        if (error.code !== 'ECONNREFUSED') throw error;
    }
    if (!process.env.MYSQL_BASEDIR || !process.env.MYSQL_CONFIG)
        throw new Error('.env의 로컬 MySQL 경로를 확인하세요.');
    const child = spawn(
        path.join(process.env.MYSQL_BASEDIR, 'bin/mysqld.exe'),
        [`--defaults-file=${process.env.MYSQL_CONFIG}`],
        { detached: true, stdio: 'ignore', windowsHide: true },
    );
    child.on('error', () => {});
    child.unref();
    for (let attempt = 0; attempt < 40; attempt++) {
        try {
            const connection = await connect();
            await connection.end();
            return console.log('MathSite MySQL 실행 완료');
        } catch {
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    }
    throw new Error('MySQL 시작 실패: 전용 DB의 mysql-error.log를 확인하세요.');
}

main().catch((error) => {
    console.error(error.code || error.message);
    process.exitCode = 1;
});
