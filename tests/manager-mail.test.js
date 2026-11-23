const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it, before, after, beforeEach } = require('mocha');
const nodemailer = require('nodemailer');
require('./database-env');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mathsite-manager-mail-'));
process.env.MAIL_SETTINGS_FILE = path.join(directory, 'sender.json');
process.env.UPLOAD_DIR = path.join(directory, 'uploads');
process.env.TEST_PASSWORD = crypto.randomBytes(24).toString('hex');
process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const { resetData } = require('./reset-data');
const { sequelize } = require('../src/models');
const app = require('../src/app');
const { client } = require('./http-client');
const { sendSignupCode, sendReset } = require('../src/modules/mail/transport');

describe('관리자의 발신 계정 변경', () => {
    const originalTransport = nodemailer.createTransport;
    const originalNow = Date.now;
    const gmail = { email: 'academy.example@gmail.com', appPassword: 'abcd efgh ijkl mnop' };
    const naver = { email: 'academy.example@naver.com', appPassword: 'navertestapp1234' };
    let server,
        admin,
        otherSession,
        student,
        guest,
        sent,
        offset = 0;

    before(async () => {
        await resetData();
        server = app.listen(0, '127.0.0.1');
        await new Promise((resolve) => server.once('listening', resolve));
        const base = () => 'http://127.0.0.1:' + server.address().port;
        [admin, otherSession, student, guest] = Array.from({ length: 4 }, () => client(base));
        for (const [request, username] of [
            [admin, 'admin'],
            [otherSession, 'admin'],
            [student, 'student'],
        ])
            assert.equal(
                (
                    await request('POST', '/auth/login', {
                        identifier: username,
                        password: process.env.TEST_PASSWORD,
                    })
                ).status,
                200,
            );
        process.env.MAIL_TRANSPORT = 'smtp';
        process.env.APP_URL = 'http://127.0.0.1:3000';
        Date.now = () => originalNow() + offset;
    });

    beforeEach(() => {
        offset += 11 * 60_000;
        process.env.MAIL_SETTINGS_FILE = path.join(directory, crypto.randomUUID() + '.json');
        sent = [];
        nodemailer.createTransport = (options) => ({
            sendMail: async (mail) => sent.push({ options, mail }),
            verify: async () => true,
            close() {},
        });
    });

    after(async () => {
        Date.now = originalNow;
        nodemailer.createTransport = originalTransport;
        if (server) {
            server.closeAllConnections();
            await new Promise((resolve) => server.close(resolve));
        }
        await sequelize.close();
        assert.equal(path.dirname(directory), os.tmpdir());
        fs.rmSync(directory, { recursive: true, force: true });
    });

    async function registerSender(sender, request = admin) {
        const started = await request('POST', '/manager/mail/verification', sender);
        assert.equal(started.status, 200, started.json?.message);
        const confirmed = await request('POST', '/manager/mail/confirm', {
            verificationId: started.json.verificationId,
            code: sent.at(-1).mail.text.match(/\d{6}/)[0],
        });
        assert.equal(confirmed.status, 200, confirmed.json?.message);
        return confirmed.json;
    }

    async function setEmailEnabled(enabled) {
        const result = await admin('PATCH', '/manager/member-fields', {
            fields: [
                { key: 'username', enabled: true },
                { key: 'nickname', enabled: true },
                { key: 'email', enabled },
            ],
        });
        assert.equal(result.status, 200, result.json.message);
    }

    it('학생과 비로그인 요청은 발신 정보 조회·검증·변경을 할 수 없다', async () => {
        for (const [request, status] of [
            [student, 403],
            [guest, 401],
        ]) {
            for (const [method, url, body] of [
                ['GET', '/manager/mail'],
                ['POST', '/manager/mail/check'],
                ['POST', '/manager/mail/verification', gmail],
                ['POST', '/manager/mail/confirm', { code: '000000' }],
            ])
                assert.equal((await request(method, url, body)).status, status);
        }
        assert.equal(sent.length, 0);
    });

    it('이메일을 끄면 발신자 API와 대기 중인 인증만 닫히고 기존 발신자는 보존된다', async () => {
        await registerSender(gmail);
        offset += 61_000;
        const started = await admin('POST', '/manager/mail/verification', naver);
        assert.equal(started.status, 200);
        const candidate = {
            verificationId: started.json.verificationId,
            code: sent.at(-1).mail.text.match(/\d{6}/)[0],
        };
        try {
            await setEmailEnabled(false);
            for (const [method, url, body] of [
                ['GET', '/manager/mail'],
                ['POST', '/manager/mail/check'],
                ['POST', '/manager/mail/verification', naver],
                ['POST', '/manager/mail/confirm', candidate],
            ]) {
                const result = await admin(method, url, body);
                assert.equal(result.status, 404);
                assert.deepEqual(result.json, { message: '등록되지 않은 API입니다.' });
            }
            assert.equal(sent.length, 2);
        } finally {
            await setEmailEnabled(true);
        }
        const restored = await admin('GET', '/manager/mail');
        assert.equal(restored.json.sender, gmail.email);
        assert.equal(restored.json.pending, null);
        assert.equal((await admin('POST', '/manager/mail/confirm', candidate)).status, 400);
    });

    it('확인 메일을 전송하는 도중 이메일을 껐다 켜도 폐기한 발신자 인증이 되살아나지 않는다', async () => {
        let started, release;
        const transmitting = new Promise((resolve) => {
            started = resolve;
        });
        const gate = new Promise((resolve) => {
            release = resolve;
        });
        nodemailer.createTransport = () => ({
            async sendMail() {
                started();
                await gate;
            },
            close() {},
        });
        const inFlight = admin('POST', '/manager/mail/verification', gmail);
        try {
            await transmitting;
            await setEmailEnabled(false);
        } finally {
            await setEmailEnabled(true);
            release();
        }
        assert.equal((await inFlight).status, 404);
        const state = (await admin('GET', '/manager/mail')).json;
        assert.equal(state.sender, null);
        assert.equal(state.pending, null);
    });

    it('기존 SMTP 환경변수가 모두 있어도 등록하지 않은 계정으로는 발송하지 않는다', async () => {
        const legacy = {
            SMTP_HOST: 'smtp.gmail.com',
            SMTP_USER: 'legacy.example@gmail.com',
            SMTP_PASSWORD: 'abcdabcdabcdabcd',
            MAIL_FROM: 'legacy.example@gmail.com',
        };
        const original = { ...process.env };
        try {
            Object.assign(process.env, legacy);
            const current = (await admin('GET', '/manager/mail')).json;
            assert.equal(current.connectionStatus, 'unregistered');
            assert.equal(current.sender, null);
            assert.equal(current.verifiedAt, null);
            assert.equal((await admin('POST', '/manager/mail/check')).status, 409);
            assert.equal((await guest('GET', '/auth/fields')).json.canRequestResetEmail, false);
            await assert.rejects(sendSignupCode('test@example.test', '123456'), { status: 503 });
            await assert.rejects(sendReset('test@example.test', 'token'), { status: 503 });
            assert.equal(sent.length, 0);
        } finally {
            for (const key of Object.keys(legacy)) {
                if (key in original) process.env[key] = original[key];
                else delete process.env[key];
            }
        }
    });

    it('새 Gmail의 코드가 확인될 때만 발신자를 교체하고 가입·초기화 메일에 함께 적용한다', async () => {
        const requested = await admin('POST', '/manager/mail/verification', gmail);
        assert.equal(requested.status, 200, requested.json?.message);
        const { verificationId } = requested.json;
        const { options, mail } = sent[0];
        assert.equal(options.host, 'smtp.gmail.com');
        assert.equal(options.auth.user, gmail.email);
        assert.equal(options.auth.pass, gmail.appPassword.replaceAll(' ', ''));
        assert.equal(options.requireTLS, true);
        assert.equal(mail.to, gmail.email);
        const code = mail.text.match(/\d{6}/)[0];
        assert.deepEqual(Object.keys(requested.json).sort(), [
            'email',
            'expiresAt',
            'message',
            'verificationId',
        ]);
        const current = (await admin('GET', '/manager/mail')).json;
        assert.equal(current.sender, null);
        assert.equal(current.connectionStatus, 'unregistered');
        assert.equal(current.pending.verificationId, verificationId);
        assert.equal((await otherSession('GET', '/manager/mail')).json.pending, null);
        assert.equal(
            (await otherSession('POST', '/manager/mail/confirm', { verificationId, code })).status,
            400,
        );
        await assert.rejects(sendSignupCode('first@example.test', '000000'), { status: 503 });
        assert.equal(sent.length, 1);
        const confirmed = await admin('POST', '/manager/mail/confirm', { verificationId, code });
        assert.equal(confirmed.status, 200);
        assert.equal(confirmed.json.sender, gmail.email);
        assert.equal(confirmed.json.connectionStatus, 'connected');
        assert.ok(confirmed.json.checkedAt);
        assert.equal(confirmed.json.pending, null);
        assert.ok(confirmed.json.verifiedAt);
        assert.ok(!confirmed.bytes.includes(Buffer.from(options.auth.pass)));
        assert.ok(
            !fs.readFileSync(process.env.MAIL_SETTINGS_FILE, 'utf8').includes(options.auth.pass),
        );
        // 이 프로세스의 캐시 없이, 저장된 암호문만 옮겨도 같은 발신 계정을 읽어야 한다.
        const restored = path.join(directory, 'restored.json');
        fs.copyFileSync(process.env.MAIL_SETTINGS_FILE, restored);
        process.env.MAIL_SETTINGS_FILE = restored;
        assert.equal((await otherSession('GET', '/manager/mail')).json.source, 'manager');
        assert.equal(
            (await admin('POST', '/manager/mail/confirm', { verificationId, code })).status,
            400,
        );
        await sendSignupCode('second@example.test', '000000');
        await sendReset('third@example.test', 'test-token');
        assert.deepEqual(
            sent.slice(-2).map((item) => item.mail.from),
            [gmail.email, gmail.email],
        );
    });

    it('네이버는 지정된 SMTP를 쓰고 오래된 요청·만료 코드·5회 오입력은 적용되지 않는다', async () => {
        const start = () => admin('POST', '/manager/mail/verification', naver);
        const first = await start();
        assert.equal(first.status, 200);
        assert.equal(sent[0].options.host, 'smtp.naver.com');
        assert.equal(sent[0].options.port, 587);
        assert.equal(sent[0].options.requireTLS, true);
        assert.equal((await start()).status, 429);
        offset += 61_000;
        const second = await start();
        assert.equal(second.status, 200);
        const code = sent[1].mail.text.match(/\d{6}/)[0];
        assert.equal(
            (
                await admin('POST', '/manager/mail/confirm', {
                    verificationId: first.json.verificationId,
                    code,
                })
            ).status,
            400,
        );
        const wrong = code === '000000' ? '000001' : '000000';
        for (let i = 1; i <= 5; i++)
            assert.equal(
                (
                    await admin('POST', '/manager/mail/confirm', {
                        verificationId: second.json.verificationId,
                        code: wrong,
                    })
                ).status,
                i === 5 ? 429 : 400,
            );
        offset += 61_000;
        const third = await start();
        offset += 10 * 60_000;
        assert.equal(
            (
                await admin('POST', '/manager/mail/confirm', {
                    verificationId: third.json.verificationId,
                    code: sent[2].mail.text.match(/\d{6}/)[0],
                })
            ).status,
            400,
        );
        assert.equal((await admin('GET', '/manager/mail')).json.source, 'none');
    });

    it('인증 실패와 허용하지 않은 주소는 기존 발신 계정을 바꾸지 않는다', async () => {
        await registerSender(naver);
        offset += 61_000;
        assert.equal(
            (
                await admin('POST', '/manager/mail/verification', {
                    ...gmail,
                    email: 'test@example.test',
                })
            ).status,
            400,
        );
        nodemailer.createTransport = () => ({
            sendMail: async () => {
                throw new Error('synthetic SMTP failure');
            },
            close() {},
        });
        assert.equal((await admin('POST', '/manager/mail/verification', gmail)).status, 502);
        const current = (await admin('GET', '/manager/mail')).json;
        assert.equal(current.sender, naver.email);
        assert.equal(current.connectionStatus, 'connected');
        assert.equal(current.pending, null);
    });

    it('연결 재확인은 메일을 보내지 않고 앱 인증 실패·일시 장애·복구 상태를 갱신한다', async () => {
        const settings = await registerSender(gmail);
        const sentBefore = sent.length;
        let failure = 'EAUTH';
        nodemailer.createTransport = (options) => ({
            verify: async () => {
                assert.equal(options.auth.user, gmail.email);
                if (failure)
                    throw Object.assign(new Error('test provider response'), { code: failure });
            },
            close() {},
        });
        for (const [code, expected] of [
            ['EAUTH', 'auth_failed'],
            ['ETIMEDOUT', 'unavailable'],
            [null, 'connected'],
        ]) {
            failure = code;
            offset += 61_000;
            const checked = await admin('POST', '/manager/mail/check');
            assert.equal(checked.status, 200, checked.json?.message);
            assert.equal(checked.json.connectionStatus, expected);
            assert.ok(checked.json.checkedAt);
            assert.equal(checked.json.verifiedAt, settings.verifiedAt);
            assert.equal((await admin('GET', '/manager/mail')).json.connectionStatus, expected);
            assert.equal(
                (await guest('GET', '/auth/fields')).json.canRequestResetEmail,
                expected !== 'auth_failed',
            );
        }
        assert.equal(sent.length, sentBefore);
    });

    it('이전 계정의 재확인 결과가 뒤늦게 도착해도 새로 확인한 계정 상태를 덮어쓰지 않는다', async () => {
        await registerSender(gmail);
        offset += 61_000;
        let release, started;
        const inFlight = new Promise((resolve) => {
            started = resolve;
        });
        const pendingVerify = new Promise((resolve) => {
            release = resolve;
        });
        nodemailer.createTransport = (options) => ({
            verify: () => {
                started();
                return pendingVerify;
            },
            sendMail: async (mail) => sent.push({ options, mail }),
            close() {},
        });
        const checking = admin('POST', '/manager/mail/check');
        try {
            await inFlight;
            await registerSender(naver, otherSession);
        } finally {
            release();
        }
        assert.equal((await checking).status, 409);
        const final = (await admin('GET', '/manager/mail')).json;
        assert.equal(final.sender, naver.email);
        assert.equal(final.connectionStatus, 'connected');
    });

    it('교체 확인 전후의 실제 발신자와 일반 메일의 인증 오류를 기록한다', async () => {
        await registerSender(gmail);
        offset += 61_000;
        const started = await admin('POST', '/manager/mail/verification', naver);
        assert.equal(started.status, 200);
        const code = sent.at(-1).mail.text.match(/\d{6}/)[0];
        await sendSignupCode('first@example.test', '123456');
        assert.equal(sent.at(-1).mail.from, gmail.email);
        const confirmed = await admin('POST', '/manager/mail/confirm', {
            verificationId: started.json.verificationId,
            code,
        });
        assert.equal(confirmed.status, 200);
        await sendReset('second@example.test', 'token');
        assert.equal(sent.at(-1).mail.from, naver.email);

        let codeFromProvider = 'EENVELOPE';
        nodemailer.createTransport = () => ({
            sendMail: async () => {
                throw Object.assign(new Error('test provider response'), {
                    code: codeFromProvider,
                });
            },
            close() {},
        });
        await assert.rejects(sendReset('unknown@example.test', 'token'), { status: 502 });
        assert.equal((await admin('GET', '/manager/mail')).json.connectionStatus, 'connected');
        codeFromProvider = 'EAUTH';
        await assert.rejects(sendSignupCode('third@example.test', '654321'), { status: 502 });
        assert.equal((await admin('GET', '/manager/mail')).json.connectionStatus, 'auth_failed');
        assert.equal((await guest('GET', '/auth/fields')).json.canRequestResetEmail, false);
    });

    it('발신 설정이 손상돼도 로그인 항목은 읽을 수 있고 관리자는 새 계정으로 복구한다', async () => {
        fs.writeFileSync(process.env.MAIL_SETTINGS_FILE, 'invalid credential file');
        const status = await admin('GET', '/manager/mail');
        assert.equal(status.status, 200);
        assert.equal(status.json.source, 'none');
        assert.match(status.json.warning, /다시 등록/);
        const fields = await guest('GET', '/auth/status');
        assert.equal(fields.status, 200);
        await assert.rejects(sendSignupCode('test@example.test', '000000'), { status: 503 });
        assert.equal(sent.length, 0);
        const request = await admin('POST', '/manager/mail/verification', naver);
        assert.equal(request.status, 200);
        const code = sent[0].mail.text.match(/\d{6}/)[0];
        const result = await admin('POST', '/manager/mail/confirm', {
            verificationId: request.json.verificationId,
            code,
        });
        assert.equal(result.status, 200);
        assert.equal(result.json.sender, naver.email);
        assert.equal(result.json.warning, null);
    });
});
