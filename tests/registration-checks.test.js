const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { describe, it, before, after } = require('mocha');
require('./database-env');
process.env.TEST_PASSWORD = crypto.randomBytes(24).toString('hex');
process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const { sequelize, User, SignupCode, MemberField } = require('../src/models');
const { resetData } = require('./reset-data');
const { client } = require('./http-client');
const { openMailbox, closeMailbox, requestCode } = require('./signup-mail');
const app = require('../src/app');

describe('가입 항목별 중복 확인', () => {
    let server, guest;
    function check(field, value) {
        return guest('POST', '/auth/register/check', { field, value });
    }
    before(async () => {
        await resetData();
        await openMailbox();
        server = app.listen(0, '127.0.0.1');
        await new Promise((resolve) => server.once('listening', resolve));
        guest = client(() => `http://127.0.0.1:${server.address().port}`);
    });
    after(async () => {
        if (server) {
            server.closeAllConnections();
            await new Promise((resolve) => server.close(resolve));
        }
        await closeMailbox();
        await sequelize.close();
    });

    it('아이디·닉네임·이메일을 각각 확인해도 회원이나 인증코드를 만들지 않는다', async () => {
        const usersBefore = await User.count();
        for (const [field, value] of Object.entries({
            username: 'new_member',
            nickname: '새 회원',
            email: 'unused@example.test',
        })) {
            const result = await check(field, value);
            assert.equal(result.status, 200);
            assert.equal(result.json.available, true);
        }
        for (const [field, value] of Object.entries({
            username: 'STUDENT',
            nickname: ' 시청 허용 학생 ',
            email: 'STUDENT@mathsite.local',
        })) {
            assert.equal((await check(field, value)).status, 409);
        }
        assert.equal((await check('email', '잘못된 주소')).status, 400);
        assert.equal(await User.count(), usersBefore);
        assert.equal(await SignupCode.count(), 0);
    });

    it('끄면 이미 쓰는 값과 빈 값 모두 알 수 없는 항목과 같은 응답을 받는다', async () => {
        await MemberField.update({ enabled: false }, { where: { key: 'nickname' } });
        try {
            const unknown = await check('role', 'x');
            assert.equal(unknown.status, 404);
            for (const value of ['시청 허용 학생', '새 이름', '']) {
                const result = await check('nickname', value);
                assert.equal(result.status, 404);
                assert.deepEqual(result.json, unknown.json);
            }
        } finally {
            await MemberField.update({ enabled: true }, { where: { key: 'nickname' } });
        }
    });

    it('중복 확인과 메일 인증 후 다른 회원이 먼저 사용한 닉네임은 최종 가입에서 거절한다', async () => {
        const profile = {
            username: 'signup_member',
            nickname: '사용 가능한 닉네임',
            email: 'signup@example.test',
        };
        assert.equal((await check('nickname', profile.nickname)).status, 200);
        const code = await requestCode(guest, profile);
        await User.update({ nickname: profile.nickname }, { where: { username: 'viewer' } });
        const result = await guest('POST', '/auth/register', {
            ...profile,
            password: process.env.TEST_PASSWORD,
            code,
        });
        assert.equal(result.status, 409);
        assert.equal(await User.count({ where: { username: profile.username } }), 0);
    });
});
