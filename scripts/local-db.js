const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { Sequelize } = require('sequelize');
require('dotenv').config({ quiet: true });
const localEnv = path.resolve('.env.local');
if (!fs.existsSync(localEnv)) throw new Error('로컬 DB 도구는 .env.local 설정이 필요합니다.');
require('dotenv').config({ path: localEnv, override: true, quiet: true });
if (!['127.0.0.1', 'localhost'].includes(process.env.DB_HOST))
    throw new Error('로컬 DB 도구는 이 PC의 MySQL에만 연결합니다.');

async function connect() {
    const client = new Sequelize(
        process.env.DB_NAME,
        process.env.DB_USER,
        process.env.DB_PASSWORD,
        {
            dialect: 'mysql',
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT),
            logging: false,
            pool: { max: 1, min: 0, idle: 1000 },
            dialectOptions: { connectTimeout: 1000 },
        },
    );
    try {
        await client.authenticate();
    } finally {
        await client.close();
    }
}

async function stop() {
    const admin = require('dotenv').parse(fs.readFileSync(path.resolve('.local/mysql-admin.env')));
    const config = path.resolve('.local/mysqladmin.cnf');
    const password = admin.MYSQL_ROOT_PASSWORD;
    if (!password || /[\r\n]/.test(password)) throw new Error('로컬 관리 설정을 확인하세요.');
    fs.writeFileSync(
        config,
        `[client]\nhost=127.0.0.1\nport=${Number(process.env.DB_PORT)}\nuser=root\npassword="${password.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"\n`,
        { mode: 0o600 },
    );
    const executable = path.join(process.env.MYSQL_BASEDIR, 'bin/mysqladmin.exe');
    try {
        const variables = execFileSync(
            executable,
            [`--defaults-extra-file=${config}`, 'variables'],
            { encoding: 'utf8', windowsHide: true },
        );
        const row = variables.split('\n').find((line) => /^\|\s*datadir\s*\|/.test(line));
        const directory = row?.split('|')[2]?.trim();
        const expected = path.resolve(path.dirname(process.env.MYSQL_CONFIG), 'data');
        if (!directory || path.resolve(directory).toLowerCase() !== expected.toLowerCase())
            throw new Error('MathSite 전용 DB가 아니므로 중지하지 않습니다.');
        execFileSync(executable, [`--defaults-extra-file=${config}`, 'shutdown'], {
            windowsHide: true,
        });
    } finally {
        fs.unlinkSync(config);
    }
}

async function main() {
    const action = process.argv[2];
    if (action === 'stop') {
        await stop();
        return console.log('MathSite MySQL 중지 완료');
    }
    if (action !== 'start') throw new Error('start 또는 stop을 지정하세요.');
    try {
        await connect();
        return console.log('MathSite MySQL 실행 중');
    } catch (error) {
        if (error.original?.code !== 'ECONNREFUSED') throw error;
    }
    if (!process.env.MYSQL_BASEDIR || !process.env.MYSQL_CONFIG)
        throw new Error('로컬 MySQL 경로를 확인하세요.');
    const child = spawn(
        path.join(process.env.MYSQL_BASEDIR, 'bin/mysqld.exe'),
        [`--defaults-file=${process.env.MYSQL_CONFIG}`],
        { detached: true, stdio: 'ignore', windowsHide: true },
    );
    child.on('error', () => {});
    child.unref();
    for (let i = 0; i < 40; i++) {
        try {
            await connect();
            return console.log('MathSite MySQL 실행 완료');
        } catch {
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    }
    throw new Error('MySQL 시작 실패: 전용 DB 로그를 확인하세요.');
}

main().catch((error) => {
    console.error(error.original?.code || error.message);
    process.exitCode = 1;
});
