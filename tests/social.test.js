const { describe, it, before, after } = require('mocha');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { ConnectionError } = require('sequelize');
require('./database-env');
process.env.TEST_PASSWORD = crypto.randomBytes(24).toString('hex');
process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
process.env.GOOGLE_CLIENT_ID = 'synthetic-google-client';
process.env.GOOGLE_CLIENT_SECRET = 'synthetic-google-secret';
process.env.KAKAO_REST_API_KEY = 'synthetic-kakao-client';
process.env.KAKAO_CLIENT_SECRET = 'synthetic-kakao-secret';
const { sequelize, User, SocialAccount, MemberField, PasswordReset } = require('../src/models');
const { resetData } = require('./reset-data');
const { openMailbox, closeMailbox, registerByEmail, requestCode } = require('./signup-mail');
const { client } = require('./http-client');
const app = require('../src/app');
const nativeFetch = globalThis.fetch;
const codes = new Map();
let server,
    base,
    admin,
    studentId,
    viewerId,
    upstreamCalls = 0;

async function login(request, identifier, password = process.env.TEST_PASSWORD) {
    return request('POST', '/auth/login', { identifier, password });
}
async function begin(request, provider, mode = '') {
    const response = await request('GET', `/auth/${provider}${mode ? '/' + mode : ''}`);
    assert.equal(response.status, 303);
    return new URL(response.headers.get('location'));
}
async function authorize(request, provider, identity, mode = '') {
    const location = await begin(request, provider, mode);
    const code = crypto.randomUUID();
    codes.set(code, { identity, provider, challenge: location.searchParams.get('code_challenge') });
    return request(
        'GET',
        `/auth/${provider}/callback?code=${code}&state=${location.searchParams.get('state')}`,
    );
}
async function configure(enabled) {
    return admin('PATCH', '/manager/member-fields', {
        fields: ['username', 'nickname', 'email'].map((key) => ({
            key,
            enabled: enabled.includes(key),
        })),
    });
}

describe('구글·카카오 복구와 회원 항목 설정', () => {
    before(async () => {
        await openMailbox();
        await resetData();
        server = app.listen(0, '127.0.0.1');
        await new Promise((resolve) => server.once('listening', resolve));
        base = `http://127.0.0.1:${server.address().port}`;
        process.env.GOOGLE_REDIRECT_URI = base + '/auth/google/callback';
        process.env.KAKAO_REDIRECT_URI = base + '/auth/kakao/callback';
        globalThis.fetch = async (url, options) => {
            if (
                [
                    'https://oauth2.googleapis.com/token',
                    'https://kauth.kakao.com/oauth/token',
                ].includes(url)
            ) {
                upstreamCalls++;
                const data = codes.get(options.body.get('code'));
                if (!data) return Response.json({ error: 'invalid_grant' }, { status: 400 });
                if (data.provider === 'google') {
                    assert.equal(
                        options.body.get('client_secret'),
                        process.env.GOOGLE_CLIENT_SECRET,
                    );
                    assert.equal(
                        crypto
                            .createHash('sha256')
                            .update(options.body.get('code_verifier'))
                            .digest('base64url'),
                        data.challenge,
                    );
                }
                return Response.json({ access_token: options.body.get('code') });
            }
            if (
                [
                    'https://openidconnect.googleapis.com/v1/userinfo',
                    'https://kapi.kakao.com/v2/user/me',
                ].includes(url)
            ) {
                upstreamCalls++;
                const data = codes.get(options.headers.Authorization.slice('Bearer '.length));
                return Response.json(
                    data.provider === 'google'
                        ? { sub: data.identity, email: 'admin@mathsite.local' }
                        : { id: data.identity },
                );
            }
            return nativeFetch(url, options);
        };
        admin = client(() => base);
        assert.equal((await login(admin, 'admin')).status, 200);
        studentId = (await User.findOne({ where: { username: 'student' } })).id;
        viewerId = (await User.findOne({ where: { username: 'viewer' } })).id;
    });
    after(async () => {
        await closeMailbox();
        globalThis.fetch = nativeFetch;
        server?.closeAllConnections();
        if (server) await new Promise((resolve) => server.close(resolve));
        await sequelize.close();
    });

    it('구글 미설정·잘못된 복귀 주소 거절과 상태 응답 비밀값 비노출', async () => {
        const request = client(() => base);
        const secret = process.env.GOOGLE_CLIENT_SECRET;
        delete process.env.GOOGLE_CLIENT_SECRET;
        assert.equal((await request('GET', '/auth/google')).status, 503);
        assert.deepEqual((await request('GET', '/auth/google/status')).json, {
            configured: false,
            registrationRequired: false,
            linked: false,
        });
        process.env.GOOGLE_CLIENT_SECRET = secret;
        const uri = process.env.GOOGLE_REDIRECT_URI;
        process.env.GOOGLE_REDIRECT_URI = 'https://example.com/wrong';
        assert.equal((await request('GET', '/auth/google')).status, 503);
        process.env.GOOGLE_REDIRECT_URI = uri;
        assert.equal(
            JSON.stringify((await request('GET', '/auth/google/status')).json).includes(secret),
            false,
        );
    });

    it('구글 state·다른 브라우저·취소·코드 재사용 차단과 PKCE', async () => {
        const request = client(() => base);
        const location = await begin(request, 'google');
        assert.equal(location.origin, 'https://accounts.google.com');
        assert.equal(location.searchParams.get('scope'), 'openid');
        assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
        assert.equal(location.searchParams.has('client_secret'), false);
        const callback = `/auth/google/callback?code=unknown&state=${location.searchParams.get('state')}`;
        const before = upstreamCalls;
        assert.equal((await client(() => base)('GET', callback)).status, 400);
        assert.equal(
            (await request('GET', callback.replace(/state=.*/, 'state=' + 'a'.repeat(64)))).status,
            400,
        );
        assert.equal(upstreamCalls, before);
        const cancelled = await begin(request, 'google');
        assert.equal(
            (
                await request(
                    'GET',
                    `/auth/google/callback?error=access_denied&state=${cancelled.searchParams.get('state')}`,
                )
            ).headers.get('location'),
            '/login?google=cancelled',
        );
        assert.equal((await request('GET', callback)).status, 400);
    });

    it('구글 가입은 승인 대기이며 이메일 일치로 관리자 계정과 합치지 않음', async () => {
        assert.equal((await configure(['username', 'nickname'])).status, 200);
        const request = client(() => base);
        assert.equal(
            (await authorize(request, 'google', 'google-new')).headers.get('location'),
            '/register?google=register',
        );
        assert.equal((await request('GET', '/auth/status')).json.loggedIn, false);
        const response = await request('POST', '/auth/google/register', {
            username: 'google_new',
            nickname: '구글 신규',
            role: 'admin',
        });
        assert.equal(response.status, 201);
        assert.equal(response.json.user.canManage, false);
        assert.equal(response.json.user.status, 'pending');
        assert.equal((await User.findByPk(response.json.user.id)).email, null);
        assert.equal((await configure(['username', 'nickname', 'email'])).status, 200);
        assert.equal(
            (await authorize(request, 'google', 'google-new')).headers.get('location'),
            '/login?google=approval',
        );
        await admin('PATCH', `/manager/users/${response.json.user.id}/status`, {
            status: 'active',
        });
        assert.equal(
            (await authorize(request, 'google', 'google-new')).headers.get('location'),
            '/courses',
        );
        assert.equal((await request('GET', '/manager/users')).status, 403);
    });

    it('이메일 ON이면 신규 구글·카카오 인증과 이전 소셜 가입 세션 모두 이메일 가입을 우회하지 못한다', async () => {
        for (const [provider, identity] of [
            ['google', 'google-policy'],
            ['kakao', 650001],
        ]) {
            const request = client(() => base);
            const count = await User.count();
            assert.equal(
                (await authorize(request, provider, identity)).headers.get('location'),
                '/register',
            );
            assert.equal(
                (await request('GET', '/auth/' + provider + '/status')).json.registrationRequired,
                false,
            );
            const fields = {
                username: 'policy_check',
                nickname: '정책 확인',
                email: 'policy@example.test',
            };
            const submit = () => request('POST', '/auth/' + provider + '/register', fields);
            assert.equal((await submit()).status, 404);
            assert.equal((await configure(['username', 'nickname'])).status, 200);
            try {
                assert.equal(
                    (await authorize(request, provider, identity)).headers.get('location'),
                    '/register?' + provider + '=register',
                );
                assert.equal(
                    (await request('GET', '/auth/' + provider + '/status')).json
                        .registrationRequired,
                    true,
                );
            } finally {
                assert.equal((await configure(['username', 'nickname', 'email'])).status, 200);
            }
            assert.equal(
                (await request('GET', '/auth/' + provider + '/status')).json.registrationRequired,
                false,
            );
            assert.equal((await submit()).status, 404);
            assert.equal(await User.count(), count);
        }
    });

    it('신규 이메일 가입 → 관리자 승인 → 구글 연동 뒤 동일한 회원으로 로그인', async () => {
        const request = client(() => base);
        const form = {
            username: 'signup_link',
            nickname: '가입 후 연동',
            email: 'signup-link@example.test',
            password: process.env.TEST_PASSWORD,
        };
        const created = await registerByEmail(request, form);
        assert.equal(created.status, 201);
        assert.equal((await login(request, form.email)).status, 403);
        assert.equal((await request('GET', '/auth/google/link')).status, 401);
        const id = created.json.user.id;
        assert.equal(
            (await admin('PATCH', '/manager/users/' + id + '/status', { status: 'active' })).status,
            200,
        );
        assert.equal((await login(request, form.email)).status, 200);
        assert.equal(
            (await authorize(request, 'google', 'signup-linked', 'link')).headers.get('location'),
            '/user',
        );
        await request('POST', '/auth/logout');
        assert.equal(
            (await authorize(request, 'google', 'signup-linked')).headers.get('location'),
            '/courses',
        );
        assert.equal((await request('GET', '/user')).json.user.id, id);
    });

    it('로그인한 계정에만 소셜 연결, 연결 충돌·권한 상승 차단', async () => {
        const request = client(() => base);
        assert.equal((await request('GET', '/auth/google/link')).status, 401);
        await login(request, 'student');
        assert.equal(
            (await authorize(request, 'google', 'google-student', 'link')).headers.get('location'),
            '/user',
        );
        assert.equal((await request('GET', '/auth/google/status')).json.linked, true);
        assert.equal(
            (await authorize(request, 'kakao', 700001, 'link')).headers.get('location'),
            '/user',
        );
        const attacker = client(() => base);
        await login(attacker, 'viewer');
        assert.equal((await authorize(attacker, 'google', 'google-student', 'link')).status, 409);
        assert.equal((await attacker('GET', '/user')).json.user.id, viewerId);
    });

    it('구글 인증으로 연결된 회원만 비밀번호 변경, 기존 세션·복구 재사용 무효화', async () => {
        const previous = client(() => base);
        await login(previous, 'student');
        const request = client(() => base);
        assert.equal(
            (await request('POST', '/auth/reset', { password: 'new-password-123' })).status,
            400,
        );
        assert.equal(
            (await authorize(request, 'google', 'google-student', 'recover')).headers.get(
                'location',
            ),
            '/reset?verified=google',
        );
        assert.equal((await request('GET', '/auth/reset/status')).json.verified, true);
        assert.equal((await request('GET', '/auth/status')).json.loggedIn, false);
        const unrelated = client(() => base);
        assert.equal(
            (
                await unrelated('POST', '/auth/reset', {
                    userId: studentId,
                    verified: true,
                    password: 'forged-password',
                })
            ).status,
            400,
        );
        assert.equal(
            (await request('POST', '/auth/reset', { password: 'new-password-123' })).status,
            200,
        );
        assert.equal((await previous('GET', '/user')).status, 401);
        assert.equal(
            (await request('POST', '/auth/reset', { password: 'another-password' })).status,
            400,
        );
        assert.equal(
            (
                await login(
                    client(() => base),
                    'student',
                )
            ).status,
            401,
        );
        assert.equal(
            (
                await login(
                    client(() => base),
                    'student',
                    'new-password-123',
                )
            ).status,
            200,
        );
    });

    it('복구 인증의 5분 만료와 동시 재설정 중 한 번만 성공', async () => {
        const request = client(() => base);
        await authorize(request, 'google', 'google-student', 'recover');
        const originalNow = Date.now;
        const future = originalNow() + 6 * 60 * 1000;
        try {
            Date.now = () => future;
            assert.equal((await request('GET', '/auth/reset/status')).json.verified, false);
            assert.equal(
                (await request('POST', '/auth/reset', { password: 'expired-password' })).status,
                400,
            );
        } finally {
            Date.now = originalNow;
        }
        await authorize(request, 'google', 'google-student', 'recover');
        const results = await Promise.all([
            request('POST', '/auth/reset', { password: 'concurrent-password' }),
            request('POST', '/auth/reset', { password: 'concurrent-password' }),
        ]);
        assert.deepEqual(results.map((result) => result.status).sort(), [200, 400]);
    });

    it('카카오 재인증·미연결·승인 상태·세션 버전 변경 후 복구 차단', async () => {
        const request = client(() => base);
        const location = await begin(request, 'kakao', 'recover');
        assert.equal(location.searchParams.get('prompt'), 'login');
        assert.equal(
            (await authorize(request, 'kakao', 799999, 'recover')).headers.get('location'),
            '/reset?kakao=unlinked',
        );
        assert.equal((await request('GET', '/auth/reset/status')).json.verified, false);
        assert.equal(
            (await authorize(request, 'kakao', 700001, 'recover')).headers.get('location'),
            '/reset?verified=kakao',
        );
        await admin('PATCH', `/manager/users/${studentId}/status`, { status: 'suspended' });
        assert.equal((await request('GET', '/auth/reset/status')).json.verified, false);
        assert.equal(
            (await request('POST', '/auth/reset', { password: 'forged-password' })).status,
            400,
        );
        await admin('PATCH', `/manager/users/${studentId}/status`, { status: 'active' });
        assert.equal(
            (await authorize(request, 'kakao', 700001, 'recover')).headers.get('location'),
            '/reset?verified=kakao',
        );
        assert.equal(
            (await request('POST', '/auth/reset', { password: process.env.TEST_PASSWORD })).status,
            200,
        );
    });

    it('회원 항목 설정은 관리자만, 비정상 설정·모든 로그인 항목 끄기 거절', async () => {
        const guest = client(() => base);
        assert.equal((await guest('GET', '/auth/fields')).json.fields.length, 3);
        assert.equal((await guest('PATCH', '/manager/member-fields', {})).status, 401);
        const student = client(() => base);
        await login(student, 'student');
        assert.equal((await student('PATCH', '/manager/member-fields', {})).status, 403);
        assert.equal((await configure(['nickname'])).status, 400);
        assert.equal(
            (await admin('PATCH', '/manager/member-fields', { fields: [null, null, null] })).status,
            400,
        );
        assert.equal(
            (
                await admin('PATCH', '/manager/member-fields', {
                    fields: [{ key: 'role', enabled: true }],
                })
            ).status,
            400,
        );
    });

    it('마지막 관리자의 로그인 방법을 보존하며 현재 앱에 소셜 연결이 있으면 전환할 수 있다', async () => {
        const owner = await User.findOne({ where: { username: 'admin' } });
        await owner.update({ username: null });
        try {
            assert.equal((await configure(['username'])).status, 409);
            assert.equal(
                (
                    await login(
                        client(() => base),
                        owner.email,
                    )
                ).status,
                200,
            );
            assert.equal(
                (await authorize(admin, 'google', 'owner-switch-test', 'link')).status,
                303,
            );
            assert.equal((await configure(['username'])).status, 200);
            const returning = client(() => base);
            assert.equal((await authorize(returning, 'google', 'owner-switch-test')).status, 303);
            assert.equal((await returning('GET', '/user')).json.user.canManage, true);
        } finally {
            await owner.update({ username: 'admin' });
            await SocialAccount.destroy({
                where: {
                    provider: 'google',
                    user_id: owner.id,
                    provider_user_id: 'owner-switch-test',
                },
            });
            await configure(['username', 'nickname', 'email']);
        }
    });

    it('회원 항목 조회 중 DB 연결 한도 초과는 재시도 가능한 503으로 안내한다', async () => {
        const findAll = MemberField.findAll;
        MemberField.findAll = async () => {
            const error = new Error(
                "User 'private-test-account' has exceeded 'max_user_connections'",
            );
            error.code = 'ER_USER_LIMIT_REACHED';
            throw new ConnectionError(error);
        };
        try {
            const response = await client(() => base)('GET', '/auth/fields');
            assert.equal(response.status, 503);
            assert.ok(Number(response.headers.get('retry-after')) > 0);
            assert.match(response.json.message, /접속 한도/);
            assert.doesNotMatch(response.json.message, /private-test-account/);
        } finally {
            MemberField.findAll = findAll;
        }
    });

    it('설정을 저장·거절·복원해도 모든 기존 회원의 번호와 가입 정보가 보존된다', async () => {
        const fields = ['username', 'nickname', 'email'];
        const storedMembers = () =>
            User.findAll({ attributes: ['id', ...fields], order: [['id', 'ASC']], raw: true });
        const before = await storedMembers();
        try {
            for (const enabled of [['username'], ['email']]) {
                const saved = await configure(enabled);
                assert.equal(saved.status, 200);
                assert.deepEqual(
                    saved.json.fields.filter((field) => field.enabled).map((field) => field.key),
                    enabled,
                );
                assert.equal((await configure(['nickname'])).status, 400);
                const current = await admin('GET', '/manager/member-fields');
                assert.equal(current.status, 200);
                assert.deepEqual(current.json.fields, saved.json.fields);
                const publicSettings = await client(() => base)('GET', '/auth/fields');
                assert.equal(publicSettings.status, 200);
                assert.deepEqual(
                    publicSettings.json.fields,
                    saved.json.fields.filter((field) => field.enabled),
                );
                assert.equal(publicSettings.json.canRequestResetEmail, enabled.includes('email'));
                assert.deepEqual(await storedMembers(), before);
            }
        } finally {
            assert.equal((await configure(fields)).status, 200);
        }
        const restored = await admin('GET', '/manager/users');
        assert.equal(restored.status, 200);
        assert.deepEqual(
            restored.json.users.map(({ id, username, nickname, email }) => ({
                id,
                username,
                nickname,
                email,
            })),
            before,
        );
    });

    it('허용된 여섯 설정 조합에서 내 정보·회원 명단·중복 확인·메일 수신자에 같은 항목을 사용한다', async () => {
        const keys = ['username', 'nickname', 'email'];
        const configurations = [
            ['username'],
            ['email'],
            ['username', 'nickname'],
            ['nickname', 'email'],
            ['username', 'email'],
            keys,
        ];
        const probe = {
            username: 'unused_field_probe',
            nickname: '설정 점검 미사용 닉네임',
            email: 'unused-field-probe@example.com',
        };
        try {
            for (const enabled of configurations) {
                assert.equal((await configure(enabled)).status, 200);
                const config = await admin('GET', '/auth/fields');
                assert.deepEqual(
                    config.json.fields.map((field) => field.key),
                    enabled,
                );
                const status = await admin('GET', '/auth/status');
                const profile = await admin('GET', '/user');
                const members = await admin('GET', '/manager/users');
                const detail = await admin('GET', '/manager/users/' + studentId);
                const recipients = await admin('GET', '/manager/broadcasts/recipients');
                assert.equal(recipients.status, enabled.includes('email') ? 200 : 404);
                const rows = [
                    status.json.user,
                    profile.json.user,
                    detail.json.user,
                    ...members.json.users,
                    ...(recipients.json.users || []),
                ];
                for (const row of rows) {
                    assert.deepEqual(
                        keys.filter((key) => Object.hasOwn(row, key)),
                        enabled,
                    );
                }
                for (const field of keys) {
                    const result = await admin('POST', '/auth/register/check', {
                        field,
                        value: probe[field],
                    });
                    assert.equal(result.status, enabled.includes(field) ? 200 : 404);
                }
            }
        } finally {
            await configure(keys);
        }
    });

    it('회원 표시에는 현재 켜 둔 닉네임·아이디·이메일 값을 순서대로 쓴다', async () => {
        const { memberLabel } = await import('../client/src/shared/memberLabel.mjs');
        const user = {
            id: 14,
            nickname: '학생별명',
            username: 'student14',
            email: 'student14@example.test',
        };
        const fields = (enabled) =>
            ['username', 'nickname', 'email'].map((key) => ({
                key,
                enabled: enabled.includes(key),
            }));
        assert.equal(memberLabel(user, fields(['username', 'nickname', 'email'])), user.nickname);
        assert.equal(memberLabel(user, fields(['username', 'email'])), user.username);
        assert.equal(memberLabel(user, fields(['email'])), user.email);
        assert.equal(memberLabel({ ...user, email: null }, fields(['email'])), '회원 번호 14');
    });

    it('이메일·닉네임 OFF는 가입·수정·응답·로그인·메일 발송까지 동일 적용', async () => {
        const fresh = client(() => base);
        const oldForm = {
            username: 'old_form',
            email: 'stale-form@example.test',
            nickname: '이전 폼',
            password: process.env.TEST_PASSWORD,
        };
        const code = await requestCode(fresh, oldForm);
        assert.equal((await configure(['username'])).status, 200);
        assert.equal((await fresh('POST', '/auth/register', { ...oldForm, code })).status, 404);
        assert.equal(await User.count({ where: { email: oldForm.email } }), 0);
        const response = await fresh('POST', '/auth/register', {
            username: 'only_username',
            password: process.env.TEST_PASSWORD,
        });
        assert.equal(response.status, 404);
        assert.equal(
            (await fresh('POST', '/auth/register/code', { email: 'unused@mathsite.local' })).status,
            404,
        );
        assert.equal(await User.count({ where: { username: 'only_username' } }), 0);
        const request = client(() => base);
        await login(request, 'viewer');
        const staleRegistration = await fresh('POST', '/auth/register', {
            username: 'hidden_email',
            email: 'hidden@mathsite.local',
            password: process.env.TEST_PASSWORD,
        });
        const staleProfile = await request('PATCH', '/user', { nickname: '몰래 변경' });
        const staleEdit = await admin('PATCH', `/manager/users/${viewerId}`, {
            email: 'hidden@mathsite.local',
        });
        assert.equal(staleRegistration.status, 404);
        for (const result of [staleProfile, staleEdit]) {
            assert.equal(result.status, 400);
            assert.doesNotMatch(result.json.message, /이메일|닉네임|email|nickname/i);
        }
        for (const value of [
            (await request('GET', '/user')).json.user,
            (await request('GET', '/auth/status')).json.user,
            (await admin('GET', `/manager/users/${viewerId}`)).json.user,
            ...(await admin('GET', '/manager/users')).json.users,
        ]) {
            assert.equal('email' in value, false);
            assert.equal('nickname' in value, false);
        }
        const unknown = await login(fresh, 'no_such_user');
        assert.equal(unknown.status, 401);
        assert.doesNotMatch(unknown.json.message, /이메일|사용하지 않|비활성/);
        for (const identifier of ['viewer@mathsite.local', 'invalid@']) {
            const denied = await login(fresh, identifier);
            assert.equal(denied.status, 401);
            assert.deepEqual(denied.json, unknown.json);
        }
        const before = (await User.findByPk(viewerId)).password_hash;
        const transport = process.env.MAIL_TRANSPORT;
        try {
            process.env.MAIL_TRANSPORT = 'smtp';
            const reset = await admin('POST', `/manager/users/${viewerId}/password-reset`);
            assert.equal(reset.status, 404);
            assert.doesNotMatch(reset.json.message, /이메일|메일|SMTP|사용하지 않|비활성/);
        } finally {
            process.env.MAIL_TRANSPORT = transport;
        }
        assert.equal((await User.findByPk(viewerId)).password_hash, before);
        const social = client(() => base);
        await authorize(social, 'google', 'google-fields');
        const signup = await social('POST', '/auth/google/register', { username: 'google_fields' });
        assert.equal(signup.status, 201);
        assert.equal('email' in signup.json.user, false);
        assert.equal('nickname' in signup.json.user, false);
        const account = await User.findByPk(signup.json.user.id);
        assert.equal(account.email, null);
        assert.equal(account.nickname, null);
    });

    it('이메일을 끄면 발급된 메일 링크도 404이며 토큰·비밀번호·세션 버전이 유지된다', async () => {
        const token = crypto.randomBytes(32).toString('hex');
        const tokenRecord = await PasswordReset.create({
            token_hash: crypto.createHash('sha256').update(token).digest('hex'),
            user_id: viewerId,
            expires_at: new Date(Date.now() + 60000),
        });
        const viewer = await User.findByPk(viewerId);
        const { password_hash, session_version } = viewer;
        try {
            assert.equal((await configure(['username'])).status, 200);
            const guest = client(() => base);
            const response = await guest('POST', '/auth/reset', {
                token,
                password: 'fresh-password-123',
            });
            assert.equal(response.status, 404);
            assert.doesNotMatch(response.json.message, /이메일|메일|사용하지 않|비활성/);
            assert.equal((await tokenRecord.reload()).used_at, null);
            await viewer.reload();
            assert.equal(viewer.password_hash, password_hash);
            assert.equal(viewer.session_version, session_version);
        } finally {
            await tokenRecord.destroy();
            assert.equal((await configure(['username', 'nickname', 'email'])).status, 200);
        }
    });

    it('다시 켜면 기존 값 보존, 관리자 수정·본인 수정·중복 제약도 함께 적용', async () => {
        assert.equal((await configure(['username', 'nickname', 'email'])).status, 200);
        assert.equal(
            (await admin('GET', `/manager/users/${viewerId}`)).json.user.nickname,
            '시청 미허용 학생',
        );
        const changed = await admin('PATCH', `/manager/users/${viewerId}`, {
            nickname: '새 닉네임',
            username: 'changed_viewer',
            email: 'changed-viewer@mathsite.local',
        });
        assert.equal(changed.status, 200);
        assert.equal(changed.json.user.nickname, '새 닉네임');
        assert.equal(
            (await admin('PATCH', `/manager/users/${viewerId}`, { role_id: 1 })).status,
            400,
        );
        assert.equal(
            (await admin('PATCH', `/manager/users/${viewerId}`, { username: 'admin' })).status,
            409,
        );
        const request = client(() => base);
        await login(request, 'changed_viewer');
        assert.equal((await request('PATCH', '/user', { nickname: '수정 학생' })).status, 200);
    });

    it('아이디 OFF일 때 이메일 가입·로그인과 NULL 아이디 복수 저장', async () => {
        assert.equal((await configure(['email'])).status, 200);
        for (const suffix of ['one', 'two']) {
            const response = await registerByEmail(
                client(() => base),
                {
                    email: `${suffix}@mathsite.local`,
                    password: process.env.TEST_PASSWORD,
                },
            );
            assert.equal(response.status, 201);
            assert.equal('username' in response.json.user, false);
            assert.equal((await User.findByPk(response.json.user.id)).username, null);
        }
        const request = client(() => base);
        const unknown = await login(request, 'no-such-user@example.test');
        assert.equal(unknown.status, 401);
        assert.doesNotMatch(unknown.json.message, /아이디|사용하지 않|비활성/);
        for (const identifier of ['admin', 'invalid@']) {
            const denied = await login(request, identifier);
            assert.equal(denied.status, 401);
            assert.deepEqual(denied.json, unknown.json);
        }
        assert.equal((await login(request, 'admin@mathsite.local')).status, 200);
        assert.equal((await configure(['username', 'nickname', 'email'])).status, 200);
    });
});
