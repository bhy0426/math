const { describe, it, before, after } = require('mocha');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
require('./database-env');

process.env.TEST_PASSWORD = crypto.randomBytes(24).toString('hex');
process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
process.env.UPLOAD_DIR = require('node:path').resolve('.local/kakao-test-uploads');
process.env.KAKAO_REST_API_KEY = 'synthetic-test-client';
process.env.KAKAO_CLIENT_SECRET = 'synthetic-test-secret';
const { pool, query } = require('../src/database');
const { initialize } = require('./seed');
const app = require('../src/app');
const { client: httpClient } = require('./http-client');
const { kakaoConfig } = require('../src/modules/auth/kakao.config');
const nativeFetch = globalThis.fetch;
let server, base, admin, adminId, studentId, courseId, lectureId;
let upstreamCalls = 0;
const codes = new Map();

function client() {
    return httpClient(() => base);
}

async function passwordLogin(request, email) {
    const result = await request('POST', '/auth/login', {
        email,
        password: process.env.TEST_PASSWORD,
    });
    assert.equal(result.status, 200);
    return result.json.user;
}

async function start(request, link = false) {
    const result = await request('GET', `/auth/kakao${link ? '/link' : ''}`);
    assert.equal(result.status, 303);
    const location = new URL(result.headers.get('location'));
    assert.equal(location.origin, 'https://kauth.kakao.com');
    assert.equal(location.searchParams.get('client_id'), process.env.KAKAO_REST_API_KEY);
    assert.equal(location.searchParams.get('redirect_uri'), process.env.KAKAO_REDIRECT_URI);
    assert.equal(location.searchParams.has('client_secret'), false);
    return location.searchParams.get('state');
}

async function authorize(request, kakaoId, link = false) {
    const state = await start(request, link);
    const code = crypto.randomUUID();
    codes.set(code, { id: kakaoId });
    return request('GET', `/auth/kakao/callback?code=${code}&state=${state}`);
}

describe('카카오 로그인 통합 테스트', function () {
    before(async () => {
        assert.equal((await query('SELECT DATABASE() AS name'))[0].name, 'mathsite_test');
        await initialize();
        const connection = await pool.getConnection();
        try {
            await connection.query('SET FOREIGN_KEY_CHECKS = 0');
            for (const table of [
                'kakao_accounts',
                'password_resets',
                'lecture_access',
                'questions',
                'boards',
                'lectures',
                'courses',
                'users',
                'roles',
            ]) {
                await connection.query(`TRUNCATE TABLE ${table}`);
            }
        } finally {
            await connection.query('SET FOREIGN_KEY_CHECKS = 1');
            connection.release();
        }
        await initialize();
        server = app.listen(0, '127.0.0.1');
        await new Promise((resolve) => server.once('listening', resolve));
        base = `http://127.0.0.1:${server.address().port}`;
        process.env.KAKAO_REDIRECT_URI = base + '/auth/kakao/callback';

        // 애플리케이션 HTTP·세션·SQL은 실제 실행하고, 카카오 서버 응답만 대체한다.
        globalThis.fetch = async (url, options) => {
            if (url === 'https://kauth.kakao.com/oauth/token') {
                upstreamCalls++;
                assert.equal(options.method, 'POST');
                assert.equal(options.body.get('client_secret'), process.env.KAKAO_CLIENT_SECRET);
                assert.equal(options.body.get('redirect_uri'), process.env.KAKAO_REDIRECT_URI);
                const code = options.body.get('code');
                const identity = codes.get(code);
                if (!identity) return Response.json({ error: 'invalid_grant' }, { status: 400 });
                return Response.json({
                    access_token: code,
                    refresh_token: 'synthetic-refresh-token',
                });
            }
            if (url === 'https://kapi.kakao.com/v2/user/me') {
                upstreamCalls++;
                const code = options.headers.Authorization.slice('Bearer '.length);
                const identity = codes.get(code);
                if (identity?.raw)
                    return new Response(identity.raw, {
                        headers: { 'Content-Type': 'application/json' },
                    });
                return Response.json(identity);
            }
            return nativeFetch(url, options);
        };
        admin = client();
        adminId = (await passwordLogin(admin, 'admin@mathsite.local')).id;
        studentId = (await query("SELECT id FROM users WHERE email = 'student@mathsite.local'"))[0]
            .id;
        courseId = (await query('SELECT id FROM courses ORDER BY id'))[0].id;
        lectureId = (await query('SELECT id FROM lectures ORDER BY id'))[0].id;
    });

    after(async () => {
        globalThis.fetch = nativeFetch;
        if (server) {
            server.closeAllConnections();
            await new Promise((resolve) => server.close(resolve));
        }
        await pool.end();
        const fs = require('node:fs/promises');
        const path = require('node:path');
        assert.equal(process.env.UPLOAD_DIR, path.resolve('.local/kakao-test-uploads'));
        await fs.rm(process.env.UPLOAD_DIR, { recursive: true, force: true });
    });

    it('미설정은 로그인 503, 상태 API는 키·시크릿을 노출하지 않음', async () => {
        const saved = process.env.KAKAO_CLIENT_SECRET;
        delete process.env.KAKAO_CLIENT_SECRET;
        try {
            const guest = client();
            assert.deepEqual((await guest('GET', '/auth/kakao/status')).json, {
                configured: false,
                registrationRequired: false,
                linked: false,
            });
            assert.equal((await guest('GET', '/auth/kakao')).status, 503);
        } finally {
            process.env.KAKAO_CLIENT_SECRET = saved;
        }
        const status = await client()('GET', '/auth/kakao/status');
        assert.equal(status.json.configured, true);
        assert.equal(status.bytes.includes(Buffer.from(saved)), false);
    });

    it('state 세션 결합·일회용·만료와 다른 브라우저 callback 차단', async () => {
        const request = client();
        const state = await start(request);
        const calls = upstreamCalls;
        const foreign = await client()('GET', `/auth/kakao/callback?code=fake&state=${state}`);
        assert.equal(foreign.status, 400);
        assert.equal(
            (await request('GET', `/auth/kakao/callback?code=fake&state=${'0'.repeat(64)}`)).status,
            400,
        );
        assert.equal(
            (await request('GET', `/auth/kakao/callback?code=fake&state=${state}`)).status,
            400,
        );
        assert.equal(upstreamCalls, calls);
        const expired = await start(request);
        const future = Date.now() + 11 * 60 * 1000;
        const originalNow = Date.now;
        Date.now = () => future;
        try {
            assert.equal(
                (await request('GET', `/auth/kakao/callback?code=fake&state=${expired}`)).status,
                400,
            );
        } finally {
            Date.now = originalNow;
        }
        assert.equal((await request('GET', '/auth/status')).json.loggedIn, false);
    });

    it('취소·토큰 실패·잘못된 회원번호는 세션 로그인하지 않음', async () => {
        const request = client();
        const state = await start(request);
        const cancelled = await request(
            'GET',
            `/auth/kakao/callback?error=access_denied&state=${state}`,
        );
        assert.equal(cancelled.headers.get('location'), '/login?kakao=cancelled');
        assert.equal(
            (await request('GET', `/auth/kakao/callback?code=fake&state=${await start(request)}`))
                .status,
            502,
        );
        assert.equal((await authorize(request, null)).status, 502);
        assert.equal((await request('GET', '/auth/status')).json.loggedIn, false);
    });

    it('최초 카카오 인증 → 이름·이메일 → 승인 대기, 이메일 자동 병합·권한 위조 금지', async () => {
        const request = client();
        assert.equal(
            (
                await request('POST', '/auth/kakao/register', {
                    name: '불가',
                    email: 'fake@mathsite.local',
                })
            ).status,
            400,
        );
        const callback = await authorize(request, 100001);
        assert.equal(callback.headers.get('location'), '/login?kakao=register');
        assert.equal((await request('GET', '/auth/kakao/status')).json.registrationRequired, true);
        assert.equal(
            (
                await request('POST', '/auth/kakao/register', {
                    name: '사칭',
                    email: 'admin@mathsite.local',
                })
            ).status,
            409,
        );
        assert.equal((await query('SELECT COUNT(*) AS total FROM kakao_accounts'))[0].total, 0);
        const created = await request('POST', '/auth/kakao/register', {
            name: '카카오 학생',
            email: 'kakao@mathsite.local',
            role: 'admin',
            kakaoId: 'forged',
        });
        assert.equal(created.status, 201);
        assert.equal(created.json.user.status, 'pending');
        assert.equal((await request('GET', '/auth/status')).json.loggedIn, false);
        assert.equal(
            (await authorize(request, 100001)).headers.get('location'),
            '/login?kakao=approval',
        );
        const [account] = await query(
            'SELECT u.id, r.code FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?',
            [created.json.user.id],
        );
        assert.equal(account.code, 'student');
        assert.equal(
            (await query('SELECT kakao_id FROM kakao_accounts WHERE user_id = ?', [account.id]))[0]
                .kakao_id,
            '100001',
        );
        await admin('PATCH', `/manager/users/${account.id}/status`, { status: 'active' });
        const loggedIn = await authorize(request, 100001);
        assert.equal(loggedIn.headers.get('location'), '/courses');
        assert.equal(loggedIn.headers.get('cache-control'), 'no-store');
        assert.equal(loggedIn.headers.get('referrer-policy'), 'no-referrer');
        assert.equal((await request('GET', '/user')).json.user.id, account.id);
        assert.equal((await request('GET', '/manager/users')).status, 403);
        assert.equal(
            (await request('GET', `/courses/${courseId}/lectures/${lectureId}`)).status,
            403,
        );
        await admin('POST', `/manager/users/${account.id}/lectures`, { lectureId });
        assert.equal(
            (
                await request('GET', `/courses/${courseId}/lectures/${lectureId}`, undefined, {
                    Range: 'bytes=0-31',
                })
            ).status,
            206,
        );
        await admin('PATCH', `/manager/users/${account.id}/status`, { status: 'suspended' });
        assert.equal((await request('GET', '/auth/status')).json.loggedIn, false);
        assert.equal(
            (await authorize(request, 100001)).headers.get('location'),
            '/login?kakao=approval',
        );
    });

    it('관리자는 이메일 인증 후 연결, 카카오 재로그인에도 기존 관리자 유지', async () => {
        const request = client();
        assert.equal((await request('GET', '/auth/kakao/link')).status, 401);
        await passwordLogin(request, 'admin@mathsite.local');
        assert.equal((await request('GET', '/auth/kakao')).status, 409);
        assert.equal((await authorize(request, 200001, true)).headers.get('location'), '/user');
        assert.equal((await request('GET', '/auth/kakao/status')).json.linked, true);
        await request('POST', '/auth/logout');
        const loggedIn = await authorize(request, 200001);
        assert.equal(loggedIn.headers.get('location'), '/courses');
        assert.match(loggedIn.headers.get('set-cookie'), /SameSite=Lax/);
        assert.equal((await request('GET', '/user')).json.user.id, adminId);
        assert.equal((await request('GET', '/manager/users')).status, 200);
        const attacker = client();
        await passwordLogin(attacker, 'student@mathsite.local');
        assert.equal((await authorize(attacker, 200001, true)).status, 409);
        assert.equal((await attacker('GET', '/user')).json.user.id, studentId);
        assert.equal((await attacker('GET', '/manager/users')).status, 403);
    });

    it('앱 변경 시 계정 자동 연결 금지, 잘못된 callback 주소 거절, 시크릿 비노출', async () => {
        const key = process.env.KAKAO_REST_API_KEY;
        process.env.KAKAO_REST_API_KEY = 'different-synthetic-app';
        try {
            const request = client();
            assert.equal(
                (await authorize(request, 200001)).headers.get('location'),
                '/login?kakao=register',
            );
            assert.equal((await request('GET', '/auth/status')).json.loggedIn, false);
        } finally {
            process.env.KAKAO_REST_API_KEY = key;
        }
        const configured = kakaoConfig();
        assert.equal(configured.configured, true);
        const uri = process.env.KAKAO_REDIRECT_URI;
        process.env.KAKAO_REDIRECT_URI = 'javascript:alert(1)';
        try {
            assert.equal((await client()('GET', '/auth/kakao')).status, 503);
        } finally {
            process.env.KAKAO_REDIRECT_URI = uri;
        }
        const form = await client()('GET', '/');
        assert.equal(form.bytes.includes(Buffer.from(process.env.KAKAO_CLIENT_SECRET)), false);
    });

    it('Long 회원번호를 반올림하지 않고 저장하고 완료 callback 재사용을 차단', async () => {
        const request = client();
        const state = await start(request);
        const code = crypto.randomUUID();
        codes.set(code, { raw: '{"id":9007199254740993}' });
        const url = `/auth/kakao/callback?code=${code}&state=${state}`;
        assert.equal((await request('GET', url)).headers.get('location'), '/login?kakao=register');
        assert.equal(
            (
                await request('POST', '/auth/kakao/register', {
                    name: '큰 ID 학생',
                    email: 'large-id@mathsite.local',
                })
            ).status,
            201,
        );
        assert.equal(
            (
                await query('SELECT kakao_id FROM kakao_accounts WHERE kakao_id = ?', [
                    '9007199254740993',
                ])
            )[0].kakao_id,
            '9007199254740993',
        );
        const calls = upstreamCalls;
        assert.equal((await request('GET', url)).status, 400);
        assert.equal(upstreamCalls, calls);
    });
});
