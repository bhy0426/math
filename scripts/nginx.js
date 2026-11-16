const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
require('dotenv').config({ quiet: true });

const prefix = path.resolve(process.env.NGINX_RUNTIME_DIR || '.local/nginx');
const normalizedPrefix = prefix.replace(/\\/g, '/') + '/';
const tools = path.resolve('.local/tools/nginx');
const installed = fs.existsSync(tools)
    ? fs.readdirSync(tools).find((name) => /^nginx-[\d.]+$/.test(name))
    : null;
const executable =
    process.env.NGINX_PATH || (installed ? path.join(tools, installed, 'nginx.exe') : 'nginx');

function running() {
    try {
        const pid = fs.readFileSync(path.join(prefix, 'logs/nginx.pid'), 'utf8').trim();
        if (!/^[1-9]\d*$/.test(pid)) return false;
        process.kill(Number(pid), 0);
        return true;
    } catch {
        return false;
    }
}

function configure() {
    const hls = path
        .resolve(
            process.env.HLS_DIR || path.join(process.env.UPLOAD_DIR || '.local/uploads', 'hls'),
        )
        .replace(/\\/g, '/');
    if (/["\r\n$;]/.test(hls)) throw new Error('영상 경로에 사용할 수 없는 문자가 있습니다.');
    const appPort = Number(process.env.PORT) || 3000;
    const nginxPort = Number(process.env.NGINX_PORT) || 8080;
    if (![appPort, nginxPort].every((port) => Number.isInteger(port) && port > 0 && port <= 65535))
        throw new Error('포트를 확인하세요.');
    fs.mkdirSync(path.join(prefix, 'logs'), { recursive: true });
    fs.mkdirSync(path.join(prefix, 'temp'), { recursive: true });
    const config = fs
        .readFileSync(path.resolve('server/nginx.conf.template'), 'utf8')
        .replaceAll('__HLS_ROOT__', hls)
        .replaceAll('__APP_PORT__', appPort)
        .replaceAll('__NGINX_PORT__', nginxPort);
    fs.writeFileSync(path.join(prefix, 'nginx.conf'), config);
    execFileSync(executable, ['-p', normalizedPrefix, '-c', 'nginx.conf', '-t'], {
        windowsHide: true,
        stdio: 'inherit',
    });
}

const action = process.argv[2];
if (action === 'stop') {
    if (running())
        execFileSync(executable, ['-p', normalizedPrefix, '-c', 'nginx.conf', '-s', 'quit'], {
            windowsHide: true,
        });
    console.log('MathSite 전용 Nginx 중지 요청 완료');
} else if (['start', 'check'].includes(action)) {
    configure();
    if (action === 'start' && !running()) {
        const child = spawn(executable, ['-p', normalizedPrefix, '-c', 'nginx.conf'], {
            cwd: prefix,
            detached: true,
            stdio: 'ignore',
            windowsHide: true,
        });
        child.on('error', () => console.error('Nginx 실행 경로를 확인하세요.'));
        child.unref();
    }
    console.log(`MathSite Nginx: http://127.0.0.1:${Number(process.env.NGINX_PORT) || 8080}`);
} else throw new Error('start, stop 또는 check를 지정하세요.');
