const { describe, it, before, after } = require('mocha');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const { execFileSync } = require('node:child_process');
const { DataTypes } = require('sequelize');
require('./database-env');
process.env.UPLOAD_DIR = path.resolve('.local/features-uploads');
process.env.RESET_MAIL_DIR = path.resolve('.local/features-mail');
process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
process.env.TEST_PASSWORD = crypto.randomBytes(24).toString('hex');
process.env.NGINX_RUNTIME_DIR = path.resolve('.local/nginx-features');
const {
    sequelize,
    User,
    Course,
    Lecture,
    PasswordReset,
    MemberField,
    SignupCode,
} = require('../src/models');
const { resetData } = require('./reset-data');
const { openMailbox, closeMailbox, registerByEmail, requestCode } = require('./signup-mail');
const { migrate } = require('../database/migrate');
const { hlsRoot, resumeConversions, waitForConversions } = require('../src/modules/courses/video');
const { writeSender } = require('../src/modules/mail/sender.store');
const { client } = require('./http-client');
const app = require('../src/app');
let server, base, admin, student, viewer, courseId, studentId, lectureId, mediaUrl;
let nginxRunning = false;

function useTestSender() {
    process.env.MAIL_TRANSPORT = 'smtp';
    process.env.MAIL_SETTINGS_FILE = path.join(process.env.SIGNUP_MAIL_DIR, 'sender.json');
    process.env.APP_URL = 'https://mathsite.invalid';
    writeSender({
        email: 'academy.example@gmail.com',
        appPassword: 'abcdabcdabcdabcd',
        verifiedAt: new Date().toISOString(),
    });
}

async function login(request, email) {
    const response = await request('POST', '/auth/login', {
        email,
        password: process.env.TEST_PASSWORD,
    });
    assert.equal(response.status, 200);
    return response.json.user;
}

async function freePort() {
    const probe = net.createServer();
    await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    return port;
}

describe('추가 기능과 FFmpeg·Nginx 통합', () => {
    before(async () => {
        await openMailbox();
        await resetData();
        server = app.listen(0, '127.0.0.1');
        await new Promise((resolve) => server.once('listening', resolve));
        base = `http://127.0.0.1:${server.address().port}`;
        admin = client(() => base);
        student = client(() => base);
        viewer = client(() => base);
        await login(admin, 'admin@mathsite.local');
        studentId = (await login(student, 'student@mathsite.local')).id;
        await login(viewer, 'viewer@mathsite.local');
        courseId = (
            await Course.findAll({ attributes: ['id'], order: [['id', 'ASC']], raw: true })
        )[0].id;
    });

    after(async () => {
        await closeMailbox();
        if (nginxRunning)
            execFileSync(process.execPath, ['scripts/nginx.js', 'stop'], {
                env: process.env,
                windowsHide: true,
            });
        await waitForConversions();
        if (server) {
            server.closeAllConnections();
            await new Promise((resolve) => server.close(resolve));
        }
        await sequelize.close();
        for (const name of ['features-uploads', 'features-mail']) {
            const target = path.resolve('.local', name);
            assert.equal(path.dirname(target), path.resolve('.local'));
            await fs.rm(target, { recursive: true, force: true });
        }
    });

    it('마이그레이션 반복 시 기존 회원·강좌 유지', async () => {
        const before = await User.findAll({
            attributes: ['id', 'email'],
            order: [['id', 'ASC']],
            raw: true,
        });
        await migrate();
        await migrate();
        assert.deepEqual(
            await User.findAll({ attributes: ['id', 'email'], order: [['id', 'ASC']], raw: true }),
            before,
        );
    });

    it('구형 발송 시각 열을 수정해 기존 인증코드를 보존하고 첫 가입 메일을 발송한다', async () => {
        const mapping = sequelize.getQueryInterface();
        const table = SignupCode.getTableName();
        const existingEmail = 'existing-code@example.test';
        const newEmail = 'first-code@example.test';
        const request = client(() => base);
        await requestCode(request, { email: existingEmail });
        const existing = await SignupCode.findByPk(existingEmail, { raw: true });
        await mapping.changeColumn(table, 'sent_at', { type: DataTypes.DATE(3), allowNull: false });

        try {
            await migrate();
            await migrate();
            assert.equal((await mapping.describeTable(table)).sent_at.allowNull, true);
            assert.deepEqual(await SignupCode.findByPk(existingEmail, { raw: true }), existing);
            await requestCode(request, { email: newEmail });
            assert.equal(await User.count({ where: { email: newEmail } }), 0);
        } finally {
            if (!(await mapping.describeTable(table)).sent_at.allowNull)
                await mapping.changeColumn(table, 'sent_at', {
                    type: DataTypes.DATE(3),
                    allowNull: true,
                });
        }
    });

    it('기존 중복 닉네임이 있어도 누락 테이블을 복구하고 회원을 보존', async () => {
        const mapping = sequelize.getQueryInterface();
        const target = await User.findOne({ where: { username: 'viewer' } });
        const previousNickname = target.nickname;
        const duplicate = (await User.findByPk(studentId)).nickname;
        const count = await User.count();
        await mapping.removeIndex('users', 'users_nickname_unique');
        try {
            await target.update({ nickname: duplicate });
            await MemberField.drop();
            assert.equal((await migrate()).duplicateNicknames, 1);
            assert.equal(await User.count(), count);
            assert.equal((await target.reload()).nickname, duplicate);
            assert.equal((await admin('GET', '/auth/fields')).status, 200);
            assert.equal(
                (await admin('PATCH', `/manager/users/${target.id}`, { nickname: duplicate }))
                    .status,
                200,
            );
            assert.equal(
                (
                    await client(() => base)('POST', '/auth/register/code', {
                        username: 'duplicate_test',
                        nickname: duplicate,
                        email: 'duplicate@mathsite.local',
                        password: process.env.TEST_PASSWORD,
                    })
                ).status,
                409,
            );
        } finally {
            await target.update({ nickname: previousNickname });
            await migrate();
        }
        assert.ok(
            (await mapping.showIndex('users')).some(
                (index) => index.name === 'users_nickname_unique',
            ),
        );
    });

    it('문자열 아이디 가입·중복 거절·승인 후 아이디/이메일 로그인', async () => {
        const fresh = client(() => base);
        const body = {
            username: 'math_student',
            nickname: '신규 학생',
            email: 'id@mathsite.local',
            password: process.env.TEST_PASSWORD,
            role: 'admin',
        };
        const created = await registerByEmail(fresh, body);
        assert.equal(created.status, 201);
        assert.equal(
            (
                await fresh('POST', '/auth/login', {
                    identifier: body.username,
                    password: body.password,
                })
            ).status,
            403,
        );
        assert.equal(
            (await fresh('POST', '/auth/register/code', { ...body, email: 'other@mathsite.local' }))
                .status,
            409,
        );
        await admin('PATCH', `/manager/users/${created.json.user.id}/status`, { status: 'active' });
        const logged = await fresh('POST', '/auth/login', {
            identifier: body.username,
            password: body.password,
        });
        assert.equal(logged.status, 200);
        assert.equal(logged.json.user.canManage, false);
        assert.equal(
            (
                await fresh('POST', '/auth/login', {
                    identifier: body.email,
                    password: body.password,
                })
            ).status,
            200,
        );
        assert.equal((await fresh('PATCH', '/user', { username: 'new_student' })).status, 200);
        assert.equal((await fresh('PATCH', '/user', { username: 'bad@id' })).status, 400);
    });

    it('인증 전에는 계정 미생성, 다른 브라우저·다른 이메일로 사용 불가, 성공한 코드 재사용 거부', async () => {
        const request = client(() => base);
        const body = {
            username: 'verify_session',
            nickname: '인증 세션',
            email: 'verify-session@example.test',
            password: process.env.TEST_PASSWORD,
        };
        const submit = (client, fields) => client('POST', '/auth/register', fields);
        const count = () => User.count({ where: { email: body.email } });
        assert.equal((await submit(request, body)).status, 400);
        const code = await requestCode(request, body);
        assert.equal(await count(), 0);
        assert.equal(
            (
                await submit(
                    client(() => base),
                    { ...body, code },
                )
            ).status,
            400,
        );
        assert.equal(
            (await submit(request, { ...body, email: 'elsewhere@example.test', code })).status,
            400,
        );
        assert.equal(await count(), 0);
        const simultaneous = await Promise.all([
            submit(request, { ...body, code }),
            submit(request, { ...body, code }),
        ]);
        assert.equal(simultaneous.filter((result) => result.status === 201).length, 1);
        assert.ok(simultaneous.some((result) => [400, 409].includes(result.status)));
        const created = simultaneous.find((result) => result.status === 201);
        assert.equal(created.json.user.status, 'pending');
        assert.equal((await request('GET', '/auth/status')).json.loggedIn, false);
        assert.equal((await submit(request, { ...body, code })).status, 409);
        assert.equal(await count(), 1);
    });

    it('재전송 대기·기한 만료·오답 제한을 적용하고 새 코드만 승인한다', async () => {
        const request = client(() => base);
        const body = {
            username: 'verify_limits',
            nickname: '인증 제한',
            email: 'verify-limit@example.test',
            password: process.env.TEST_PASSWORD,
        };
        const verify = (code) => request('POST', '/auth/register', { ...body, code });
        const updateTimes = (dates) => SignupCode.update(dates, { where: { email: body.email } });
        const oldCode = await requestCode(request, body);
        assert.equal((await request('POST', '/auth/register/code', body)).status, 429);
        await updateTimes({ expires_at: new Date(Date.now() - 1000) });
        assert.equal((await verify(oldCode)).status, 400);
        await updateTimes({ sent_at: new Date(Date.now() - 61000) });
        const code = await requestCode(request, body);
        // 이전 코드와 새 코드가 우연히 같더라도 반드시 틀린 값을 사용한다.
        const wrong = oldCode !== code ? oldCode : code === '000000' ? '000001' : '000000';
        for (let attempt = 1; attempt <= 5; attempt++) {
            assert.equal((await verify(wrong)).status, attempt < 5 ? 400 : 429);
        }
        assert.equal((await verify(code)).status, 429);
        assert.equal(await User.count({ where: { email: body.email } }), 0);
        await updateTimes({ sent_at: new Date(Date.now() - 61000) });
        assert.equal((await verify(await requestCode(request, body))).status, 201);
    });

    it('인증 메일을 보낼 수 없으면 가입이나 코드 발급이 완료되지 않는다', async () => {
        const request = client(() => base);
        const email = 'unsent-signup@example.test';
        const mode = process.env.MAIL_TRANSPORT;
        try {
            process.env.MAIL_TRANSPORT = 'smtp';
            const result = await request('POST', '/auth/register/code', {
                email,
                username: 'unsent_signup',
                nickname: '미발송 가입',
            });
            assert.equal(result.status, 503);
            assert.match(result.json.message, /회원가입 인증 메일/);
            assert.equal(await User.count({ where: { email } }), 0);
            assert.equal(await SignupCode.count({ where: { email } }), 0);
        } finally {
            process.env.MAIL_TRANSPORT = mode;
        }
    });

    it('회원 상세·역할 CRUD·회원 삭제는 관리자만 가능', async () => {
        const created = await admin('POST', '/manager', { code: 'trial', name: '체험 학생' });
        assert.equal(created.status, 201);
        const roleId = created.json.roleId;
        assert.equal(
            (await admin('PATCH', '/manager', { roleId, name: '수정한 역할' })).status,
            200,
        );
        const account = await registerByEmail(
            client(() => base),
            {
                nickname: '삭제 대상',
                username: 'delete_student',
                email: 'remove@mathsite.local',
                password: process.env.TEST_PASSWORD,
            },
        );
        const id = account.json.user.id;
        assert.equal((await admin('PATCH', `/manager/users/${id}/role`, { roleId })).status, 200);
        assert.equal(
            (await admin('GET', `/manager/users/${id}`)).json.user.roleName,
            '수정한 역할',
        );
        assert.equal((await student('DELETE', `/manager/users/${id}`)).status, 403);
        assert.equal((await admin('DELETE', '/manager', { roleId })).status, 409);
        assert.equal((await admin('DELETE', `/manager/users/${id}`)).status, 200);
        assert.equal((await admin('DELETE', '/manager', { roleId })).status, 200);
    });

    it('팝업 공지 조회·해제, 학생의 팝업 설정 거절', async () => {
        const created = await admin('POST', '/boards', {
            title: '팝업 공지',
            content: '알림 내용',
            popupEnabled: true,
            isPinned: true,
        });
        assert.equal(created.status, 201);
        const id = created.json.board.id;
        assert.equal((await student('GET', '/boards/popup')).json.board.id, id);
        assert.equal(
            (await student('PATCH', '/boards/' + id, { popupEnabled: false })).status,
            403,
        );
        await admin('PATCH', '/boards/' + id, { popupEnabled: false });
        assert.equal((await student('GET', '/boards/popup')).json.board, null);
    });

    it('공식 채팅 설정과 일반 사용자 재설정 발송은 제거', async () => {
        assert.equal((await admin('GET', '/info/settings')).status, 404);
        assert.equal((await admin('PATCH', '/info/settings', { channelUrl: '' })).status, 404);
        assert.equal(
            (await viewer('POST', '/auth/reset', { email: 'viewer@mathsite.local' })).status,
            400,
        );
        assert.equal(
            (await student('POST', `/manager/users/${studentId}/password-reset`)).status,
            403,
        );
    });

    it('관리자 초기화만 메일 발송·기존 비밀번호와 세션 무효화', async () => {
        const target = await User.findOne({ where: { email: 'viewer@mathsite.local' } });
        const before = target.password_hash;
        const oldMode = process.env.MAIL_TRANSPORT;
        process.env.MAIL_TRANSPORT = 'smtp';
        assert.equal((await admin('GET', '/auth/fields')).json.canRequestResetEmail, false);
        assert.equal(
            (await admin('POST', `/manager/users/${target.id}/password-reset`)).status,
            503,
        );
        assert.equal((await User.findByPk(target.id)).password_hash, before);
        process.env.MAIL_TRANSPORT = oldMode;
        const result = await admin('POST', `/manager/users/${target.id}/password-reset`);
        assert.equal(result.status, 200);
        assert.equal((await viewer('GET', '/user')).status, 401);
        assert.equal(
            (
                await viewer('POST', '/auth/login', {
                    email: target.email,
                    password: process.env.TEST_PASSWORD,
                })
            ).status,
            401,
        );
        const files = await fs.readdir(process.env.RESET_MAIL_DIR);
        const mails = await Promise.all(
            files.map((file) =>
                fs.readFile(path.join(process.env.RESET_MAIL_DIR, file), 'utf8').then(JSON.parse),
            ),
        );
        const pending = await PasswordReset.findOne({
            where: { user_id: target.id, used_at: null },
        });
        const mail = mails.find(
            (mail) =>
                crypto.createHash('sha256').update(mail.token).digest('hex') === pending.token_hash,
        );
        assert.ok(mail.url.includes('/reset?token='));
        assert.ok(!JSON.stringify(result.json).includes(mail.token));
        assert.equal(
            (
                await viewer('POST', '/auth/reset', {
                    token: mail.token,
                    password: process.env.TEST_PASSWORD,
                })
            ).status,
            200,
        );
        assert.equal(
            (
                await viewer('POST', '/auth/reset', {
                    token: mail.token,
                    password: process.env.TEST_PASSWORD,
                })
            ).status,
            400,
        );
        await login(viewer, 'viewer@mathsite.local');
    });

    it('SMTP 발송 함수의 TLS·메일 내용·수신자 구성 (외부 발송 없이)', async () => {
        const nodemailer = require('nodemailer');
        const original = nodemailer.createTransport;
        const previous = { ...process.env };
        let options, sent;
        nodemailer.createTransport = (config) => {
            options = config;
            return {
                sendMail: async (message) => {
                    sent = message;
                },
                close() {},
            };
        };
        try {
            useTestSender();
            await require('../src/modules/mail/transport').sendReset(
                'student@mathsite.local',
                'synthetic-reset-token',
            );
            assert.equal(options.requireTLS, true);
            assert.equal(options.auth.user, 'academy.example@gmail.com');
            assert.equal(sent.from, options.auth.user);
            assert.equal(sent.to, 'student@mathsite.local');
            assert.ok(
                sent.text.includes('https://mathsite.invalid/reset?token=synthetic-reset-token'),
            );
            await require('../src/modules/mail/transport').sendSignupCode(
                'new@example.test',
                '012345',
            );
            assert.equal(sent.to, 'new@example.test');
            assert.match(sent.subject, /회원가입/);
            assert.match(sent.text, /012345/);
        } finally {
            nodemailer.createTransport = original;
            for (const key of Object.keys(process.env))
                if (!(key in previous)) delete process.env[key];
            Object.assign(process.env, previous);
        }
    });

    it('아이디·닉네임은 가입과 프로필 수정에서 각각 중복 거절', async () => {
        const fresh = client(() => base);
        const body = {
            username: 'unique_member',
            nickname: '고유 닉네임',
            email: 'unique@mathsite.local',
            password: process.env.TEST_PASSWORD,
        };
        const created = await registerByEmail(fresh, body);
        assert.equal(created.status, 201);
        assert.equal(
            (
                await fresh('POST', '/auth/register/code', {
                    ...body,
                    username: 'another_member',
                    email: 'other-nick@mathsite.local',
                })
            ).status,
            409,
        );
        assert.equal(
            (
                await fresh('POST', '/auth/register/code', {
                    ...body,
                    nickname: '다른 닉네임',
                    email: 'other-id@mathsite.local',
                })
            ).status,
            409,
        );
        await admin('PATCH', `/manager/users/${created.json.user.id}/status`, { status: 'active' });
        assert.equal(
            (
                await fresh('POST', '/auth/login', {
                    identifier: body.username,
                    password: body.password,
                })
            ).status,
            200,
        );
        assert.equal((await fresh('PATCH', '/user', { nickname: '시청 허용 학생' })).status, 409);
        assert.equal((await fresh('PATCH', '/user', { username: 'student' })).status, 409);
        assert.equal((await fresh('GET', '/user')).json.user.nickname, body.nickname);
    });

    it('반복 PBKDF2·개별 salt·이전 scrypt 로그인 시 해시 갱신', async () => {
        const {
            hashPassword,
            verifyPassword,
            ITERATIONS,
        } = require('../src/modules/auth/password');
        const first = await hashPassword(process.env.TEST_PASSWORD);
        const second = await hashPassword(process.env.TEST_PASSWORD);
        assert.equal(ITERATIONS, 600000);
        assert.notEqual(first, second);
        assert.ok(first.startsWith('pbkdf2$sha256$600000$'));
        assert.equal(await verifyPassword(process.env.TEST_PASSWORD, first), true);
        assert.equal(await verifyPassword('wrong-password', first), false);
        assert.equal(await verifyPassword('wrong-password', 'broken-hash'), false);
        const salt = crypto.randomBytes(16).toString('hex');
        const legacy = await new Promise((resolve, reject) =>
            crypto.scrypt(process.env.TEST_PASSWORD, salt, 64, (error, value) =>
                error ? reject(error) : resolve(value),
            ),
        );
        const account = await User.findByPk(studentId);
        await account.update({ password_hash: `${salt}:${legacy.toString('hex')}` });
        await login(
            client(() => base),
            'student@mathsite.local',
        );
        const updated = await User.findByPk(studentId);
        assert.ok(updated.password_hash.startsWith('pbkdf2$sha256$600000$'));
    });

    it('기존 짧은 비밀번호도 로그인 후 반복 해시로 이전, 신규 짧은 암호는 거절', async () => {
        const short = 'old1';
        const salt = crypto.randomBytes(16).toString('hex');
        const legacy = crypto.scryptSync(short, salt, 64).toString('hex');
        const account = await User.findOne({ where: { username: 'viewer' } });
        await account.update({ password_hash: `${salt}:${legacy}` });
        const response = await client(() => base)('POST', '/auth/login', {
            identifier: 'viewer',
            password: short,
        });
        assert.equal(response.status, 200);
        assert.ok((await account.reload()).password_hash.startsWith('pbkdf2$sha256$600000$'));
        const { hashPassword } = require('../src/modules/auth/password');
        await assert.rejects(hashPassword(short), { status: 400 });
        await account.update({ password_hash: await hashPassword('ChangedPassword123') });
        const { loginSession } = require('../src/modules/auth/session');
        await assert.rejects(loginSession({}, account.id, account.session_version + 1), {
            status: 401,
        });
    });

    it('실제 SMTP 전달 실패 시 관리자 강제 초기화 전체 롤백', async () => {
        const nodemailer = require('nodemailer');
        const original = nodemailer.createTransport;
        const previous = { ...process.env };
        const account = await User.findByPk(studentId);
        const before = {
            hash: account.password_hash,
            version: account.session_version,
            tokens: await PasswordReset.count({ where: { user_id: studentId } }),
        };
        nodemailer.createTransport = () => ({
            sendMail: async () => {
                throw new Error('synthetic SMTP failure');
            },
            close() {},
        });
        try {
            useTestSender();
            assert.equal(
                (await admin('POST', `/manager/users/${studentId}/password-reset`)).status,
                502,
            );
            const signupEmail = 'failed-send@example.test';
            const send = await client(() => base)('POST', '/auth/register/code', {
                username: 'failed_send',
                nickname: '메일 실패',
                email: signupEmail,
            });
            assert.equal(send.status, 502);
            assert.match(send.json.message, /메일 발송/);
            assert.equal(await SignupCode.count({ where: { email: signupEmail } }), 0);
            const after = await User.findByPk(studentId);
            assert.equal(after.password_hash, before.hash);
            assert.equal(after.session_version, before.version);
            assert.equal(
                await PasswordReset.count({ where: { user_id: studentId } }),
                before.tokens,
            );
            assert.equal((await student('GET', '/user')).status, 200);
        } finally {
            nodemailer.createTransport = original;
            for (const key of Object.keys(process.env))
                if (!(key in previous)) delete process.env[key];
            Object.assign(process.env, previous);
        }
    });

    it('서버·마이그레이션·스크립트는 ORM을 사용하고 API 라우터는 DB를 직접 호출하지 않음', async () => {
        const { parsers } = require('prettier/plugins/babel');
        const sourceFiles = [];
        for (const directory of ['src', 'database', 'scripts']) {
            const names = await fs.readdir(directory, { recursive: true });
            sourceFiles.push(
                ...names
                    .filter((name) => name.endsWith('.js'))
                    .map((name) => path.join(directory, name)),
            );
        }
        for (const file of sourceFiles) {
            const source = await fs.readFile(file, 'utf8');
            const ast = await parsers.babel.parse(source);
            function inspect(node) {
                if (!node || typeof node !== 'object') return;
                if (node.type === 'CallExpression' && node.callee.name === 'require') {
                    const dependency = node.arguments[0]?.value || '';
                    assert.doesNotMatch(
                        dependency,
                        /^(?:mysql2?|mariadb)(?:\/|$)/,
                        `직접 DB 드라이버 사용: ${file}`,
                    );
                    if (file.endsWith('routes.js')) {
                        assert.doesNotMatch(
                            dependency,
                            /^(?:sequelize$)|(?:^|\/)(?:models|database)(?:\.js)?$/,
                            `라우터에서 DB 모듈 사용: ${file}`,
                        );
                    }
                }
                if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
                    const method = node.callee.property.name ?? node.callee.property.value;
                    assert.ok(
                        !['query', 'execute', 'literal'].includes(method),
                        `직접 DB 문장 호출: ${file}`,
                    );
                    if (
                        file.endsWith('routes.js') &&
                        !['service', 'stream', 'res'].includes(node.callee.object.name)
                    )
                        assert.ok(
                            ![
                                'findAll',
                                'findOne',
                                'findByPk',
                                'create',
                                'update',
                                'destroy',
                                'transaction',
                            ].includes(method),
                            `라우터 DB 동작: ${file}`,
                        );
                }
                if (file.endsWith('routes.js'))
                    assert.notEqual(
                        node.type,
                        'FunctionDeclaration',
                        `라우터 안의 기능 함수: ${file}`,
                    );
                for (const [key, value] of Object.entries(node)) {
                    if (['loc', 'comments', 'tokens'].includes(key)) continue;
                    if (Array.isArray(value)) value.forEach(inspect);
                    else if (value?.type) inspect(value);
                }
            }
            inspect(ast);
        }
    });

    it('다른 PC에만 원본이 있는 강의는 재개·재변환하지 않고 로컬 재생 가능 여부를 확인한다', async () => {
        const filename = crypto.randomUUID() + '.mp4';
        const row = await Lecture.create({
            course_id: courseId,
            title: '공유 DB의 영상',
            description: '다른 서버에서 올린 원본이 이 저장소에 없는 경우',
            video_file: filename,
            mime_type: 'video/mp4',
            video_status: 'PROCESSING',
        });
        const url = `/courses/${courseId}/lectures/${row.id}`;
        await resumeConversions();
        await waitForConversions();
        assert.equal((await row.reload()).video_status, 'PROCESSING');
        const key = crypto.randomUUID();
        await row.update({ video_status: 'READY', hls_key: key });
        assert.equal((await admin('POST', url + '/convert')).status, 404);
        assert.equal((await admin('POST', url + '/playback')).status, 404);
        assert.equal((await admin('GET', url + '/hls/' + key + '/index.m3u8')).status, 404);
        assert.equal((await row.reload()).video_status, 'READY');
        assert.equal(row.hls_key, key);
        await fs.copyFile(
            path.join(__dirname, 'fixtures/sample.mp4'),
            path.join(process.env.UPLOAD_DIR, filename),
        );
        assert.equal((await admin('POST', url + '/playback')).json.format, 'original');
        await admin('DELETE', url);
    });

    it('변환 중 잘못된 파일로 교체를 요청해도 이전 원본의 변환이 끝난다', async () => {
        // 이전 변환이 끝나기 전에 교체 요청이 도달하도록 변환 폴더 생성을 잠시 보류한다.
        const mkdir = fs.mkdir;
        const pause = Promise.withResolvers();
        fs.mkdir = async (directory, ...options) => {
            if (path.dirname(directory) === hlsRoot) await pause.promise;
            return mkdir(directory, ...options);
        };
        let row, timeout;
        try {
            const form = new FormData();
            const sample = await fs.readFile(path.join(__dirname, 'fixtures/sample.mp4'));
            form.set('title', '영상 교체 실패 검사');
            form.set('video', new Blob([sample]), 'original.mp4');
            const created = await admin('POST', `/courses/${courseId}/lectures`, form);
            assert.equal(created.status, 201);
            row = await Lecture.findByPk(created.json.lecture.id);
            const before = row.video_file;
            const invalid = new FormData();
            invalid.set('video', new Blob(['invalid video']), 'wrong.mp4');
            timeout = setTimeout(pause.resolve, 2500);
            assert.equal(
                (await admin('PATCH', `/courses/${courseId}/lectures/${row.id}`, invalid)).status,
                400,
            );
            pause.resolve();
            await waitForConversions();
            assert.equal((await row.reload()).video_file, before);
            assert.equal(row.video_status, 'READY');
        } finally {
            clearTimeout(timeout);
            pause.resolve();
            fs.mkdir = mkdir;
            await waitForConversions();
            if (row) await admin('DELETE', `/courses/${courseId}/lectures/${row.id}`);
        }
    });

    it('실제 FFmpeg HLS 변환·강의 제목 검색·학생별 권한', async () => {
        const fixture = await fs.readFile(path.join(__dirname, 'fixtures/sample.mp4'));
        const form = new FormData();
        form.set('title', 'HLS 변환 검사');
        form.set('video', new Blob([fixture], { type: 'video/mp4' }), 'sample.mp4');
        const created = await admin('POST', `/courses/${courseId}/lectures`, form);
        assert.equal(created.status, 201);
        lectureId = created.json.lecture.id;
        await waitForConversions();
        const [row] = await Lecture.findAll({ where: { id: lectureId }, raw: true });
        assert.equal(row.video_status, 'READY');
        await admin('POST', `/manager/users/${studentId}/lectures`, { lectureId });
        assert.equal(
            (await student('GET', `/courses/${courseId}/lectures?q=HLS`)).json.lectures.length,
            1,
        );
        const playback = await student(
            'POST',
            `/courses/${courseId}/lectures/${lectureId}/playback`,
        );
        assert.equal(playback.json.format, 'hls');
        mediaUrl = playback.json.playbackUrl.replace(/^\/api/, '');
        const playlist = await student('GET', mediaUrl);
        assert.equal(playlist.status, 200);
        assert.match(playlist.bytes.toString(), /#EXTM3U/);
        assert.equal((await viewer('GET', mediaUrl)).status, 403);
        const segment = playlist.bytes
            .toString()
            .split('\n')
            .find((line) => /^segment-/.test(line));
        assert.equal((await student('GET', mediaUrl.replace('index.m3u8', segment))).status, 200);
        assert.equal(
            (await student('GET', mediaUrl.replace('index.m3u8', 'private.txt'))).status,
            400,
        );
    });

    it('실제 Nginx 내부 파일 제공·직접 URL 차단·회수 후 조각 요청 차단', async () => {
        process.env.PORT = String(server.address().port);
        process.env.NGINX_PORT = String(await freePort());
        execFileSync(process.execPath, ['scripts/nginx.js', 'start'], {
            env: process.env,
            windowsHide: true,
        });
        nginxRunning = true;
        const proxyBase = `http://127.0.0.1:${process.env.NGINX_PORT}`;
        let ready = false;
        for (let i = 0; i < 40; i++) {
            try {
                if ((await fetch(proxyBase + '/health')).ok) {
                    ready = true;
                    break;
                }
            } catch {
                /* 초기 실행 대기 */
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        assert.ok(ready, 'Nginx 시작');
        const request = client(() => proxyBase);
        await login(request, 'student@mathsite.local');
        const playlist = await request('GET', mediaUrl);
        assert.equal(playlist.status, 200);
        assert.match(playlist.headers.get('server'), /nginx/);
        assert.equal(playlist.headers.get('x-accel-redirect'), null);
        const segment = playlist.bytes
            .toString()
            .split('\n')
            .find((line) => /^segment-/.test(line));
        const segmentUrl = mediaUrl.replace('index.m3u8', segment);
        assert.equal((await request('GET', segmentUrl)).status, 200);
        const [row] = await Lecture.findAll({ where: { id: lectureId }, raw: true });
        assert.equal(
            (await fetch(proxyBase + `/_protected_media/${row.hls_key}/index.m3u8`)).status,
            404,
        );
        await admin('DELETE', `/manager/users/${studentId}/lectures/${lectureId}`);
        assert.equal((await request('GET', segmentUrl)).status, 403);
        assert.equal((await request('GET', mediaUrl)).status, 403);
    });
});
