const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { once } = require('node:events');
const nodemailer = require('nodemailer');
const { before, after, beforeEach, describe, it } = require('mocha');
require('./database-env');
process.env.TEST_PASSWORD = crypto.randomBytes(24).toString('hex');
process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const {
    sequelize,
    User,
    Group,
    GroupMember,
    MemberField,
    Broadcast,
    BroadcastDelivery,
} = require('../src/models');
const { writeSender } = require('../src/modules/manager/mail-sender.store');
const { resetData } = require('./reset-data');
const { client } = require('./http-client');
const app = require('../src/app');

describe('관리자 학생 안내 메일', () => {
    let server, directory, admin, staff, student, ids, group, sent, transmit;
    const originalTransport = nodemailer.createTransport;
    const base = '/manager/broadcasts';
    const sender = {
        email: 'test-academy@gmail.com',
        appPassword: 'abcdefghijklmnop',
        verifiedAt: new Date().toISOString(),
    };
    before(async () => {
        directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mathsite-broadcast-'));
        process.env.MAIL_TRANSPORT = 'smtp';
        process.env.MAIL_SETTINGS_FILE = path.join(directory, 'sender.json');
        await resetData();
        const owner = await User.findOne({ where: { username: 'admin' } });
        await User.create({
            username: 'staff',
            nickname: '안내 담당',
            email: 'staff@example.test',
            password_hash: owner.password_hash,
            role_id: owner.role_id,
            status: 'active',
        });
        ids = Object.fromEntries((await User.findAll()).map((row) => [row.username, row.id]));
        server = app.listen(0, '127.0.0.1');
        await once(server, 'listening');
        [admin, staff, student] = Array.from({ length: 3 }, () =>
            client(() => 'http://127.0.0.1:' + server.address().port),
        );
        for (const [request, identifier] of [
            [admin, 'admin'],
            [staff, 'staff'],
            [student, 'student'],
        ]) {
            assert.equal(
                (
                    await request('POST', '/auth/login', {
                        identifier,
                        password: process.env.TEST_PASSWORD,
                    })
                ).status,
                200,
            );
        }
        nodemailer.createTransport = (options) => ({
            sendMail: async (mail) => {
                assert.equal(options.auth.user, sender.email);
                sent.push(mail);
                return transmit(mail);
            },
            close() {},
        });
        writeSender(sender);
        group = await Group.create({ name: '초급반' });
        await GroupMember.bulkCreate(
            [ids.student, ids.viewer].map((user_id) => ({ user_id, group_id: group.id })),
        );
    });
    beforeEach(() => {
        sent = [];
        transmit = async () => ({});
    });
    after(async () => {
        nodemailer.createTransport = originalTransport;
        if (server) {
            server.closeAllConnections();
            await new Promise((resolve) => server.close(resolve));
        }
        await sequelize.close();
        if (
            directory &&
            path.dirname(directory) === os.tmpdir() &&
            path.basename(directory).startsWith('mathsite-broadcast-')
        )
            await fs.rm(directory, { recursive: true, force: true });
    });
    function draft(userIds) {
        return {
            requestId: crypto.randomUUID(),
            groupId: group.id,
            userIds,
            subject: '다음 수업 안내',
            body: '다음 수업은 오후 3시입니다.',
        };
    }
    async function finished(key) {
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline) {
            const res = await admin('GET', base + '/' + key);
            assert.equal(res.status, 200);
            if (res.json.status === 'complete') return res.json;
            await delay(20);
        }
        assert.fail('학생별 발송이 완료되지 않았습니다.');
    }

    it('관리자만 대상과 이메일을 조회하며 꺼진 필드와 비활성 학생을 제외한다', async () => {
        assert.equal((await student('GET', base + '/recipients')).status, 403);
        assert.equal((await student('POST', base, draft([ids.student]))).status, 403);
        try {
            await MemberField.update({ enabled: false }, { where: { key: 'nickname' } });
            await User.update({ status: 'suspended' }, { where: { id: ids.viewer } });
            const { users } = (await admin('GET', base + '/recipients?groupId=' + group.id)).json;
            assert.deepEqual(
                users.map((u) => u.id),
                [ids.student],
            );
            assert.equal(Object.hasOwn(users[0], 'nickname'), false);
            assert.equal((await admin('POST', base, draft([ids.viewer]))).status, 409);
            await MemberField.update({ enabled: false }, { where: { key: 'email' } });
            assert.equal((await admin('GET', base + '/recipients')).status, 404);
            assert.equal((await admin('POST', base, draft([ids.student]))).status, 404);
            assert.equal(sent.length, 0);
        } finally {
            await MemberField.update({ enabled: true }, { where: { key: ['nickname', 'email'] } });
            await User.update({ status: 'active' }, { where: { id: ids.viewer } });
        }
    });
    it('선택 학생만 개별 수신자로 발송하고 같은 요청의 동시 전송·재시도는 중복 발송하지 않는다', async () => {
        const data = draft([ids.student, ids.student]);
        let release;
        const gate = new Promise((resolve) => {
            release = resolve;
        });
        transmit = async () => gate;
        try {
            const submissions = await Promise.all([
                admin('POST', base, data),
                admin('POST', base, data),
            ]);
            assert.ok(submissions.every((r) => r.status === 202));
        } finally {
            release();
        }
        const result = await finished(data.requestId);
        assert.deepEqual(result.recipients, [{ userId: ids.student, status: 'sent' }]);
        assert.equal((await admin('POST', base, data)).status, 200);
        assert.equal((await admin('POST', base, { ...data, body: '수정된 내용' })).status, 409);
        assert.equal((await staff('GET', base + '/' + data.requestId)).status, 404);
        assert.equal((await staff('POST', base, data)).status, 404);
        await MemberField.update({ enabled: false }, { where: { key: 'email' } });
        try {
            for (const [method, url, body] of [
                ['GET', base + '/' + data.requestId],
                ['POST', base, data],
            ]) {
                const blocked = await admin(method, url, body);
                assert.equal(blocked.status, 404);
                assert.deepEqual(blocked.json, { message: '등록되지 않은 API입니다.' });
            }
        } finally {
            await MemberField.update({ enabled: true }, { where: { key: 'email' } });
        }
        assert.deepEqual((await admin('GET', base + '/' + data.requestId)).json, result);
        assert.deepEqual(
            sent.map((m) => [m.from, m.to, m.cc, m.bcc]),
            [[sender.email, 'student@mathsite.local', undefined, undefined]],
        );
    });
    it('잘못된 대상이나 낡은 그룹 선택은 접수 전에 거절하고 메일을 보내지 않는다', async () => {
        const registered = process.env.MAIL_SETTINGS_FILE;
        process.env.MAIL_SETTINGS_FILE = path.join(directory, 'unregistered.json');
        try {
            assert.equal((await admin('POST', base, draft([ids.student]))).status, 503);
        } finally {
            process.env.MAIL_SETTINGS_FILE = registered;
        }
        await GroupMember.destroy({ where: { group_id: group.id, user_id: ids.viewer } });
        try {
            for (const data of [draft([ids.student, ids.viewer]), draft([ids.admin]), draft([])]) {
                const res = await admin('POST', base, data);
                assert.ok([400, 409].includes(res.status));
                assert.equal(await Broadcast.count({ where: { request_id: data.requestId } }), 0);
            }
            assert.equal(sent.length, 0);
        } finally {
            await GroupMember.create({ group_id: group.id, user_id: ids.viewer });
        }
    });
    it('일부 SMTP 거절과 응답 유실을 학생별로 구분하고 나머지 학생 처리를 이어간다', async () => {
        const data = draft([ids.student, ids.viewer]);
        transmit = async (mail) => {
            if (mail.to === 'student@mathsite.local')
                throw Object.assign(new Error('rejected'), {
                    code: 'EENVELOPE',
                    responseCode: 550,
                });
            throw Object.assign(new Error('reply missing'), { code: 'ETIMEDOUT' });
        };
        assert.equal((await admin('POST', base, data)).status, 202);
        const result = await finished(data.requestId);
        assert.deepEqual(result.recipients, [
            { userId: ids.student, status: 'failed' },
            { userId: ids.viewer, status: 'unknown' },
        ]);
        await admin('POST', base, data);
        assert.equal(sent.length, 2);
    });
    it('대기하던 학생이 그룹에서 빠지면 실제 발송 직전에 제외한다', async () => {
        const data = draft([ids.student, ids.viewer]);
        let release;
        const gate = new Promise((resolve) => {
            release = resolve;
        });
        transmit = () => gate;
        try {
            assert.equal((await admin('POST', base, data)).status, 202);
            const deadline = Date.now() + 3000;
            while (!sent.length && Date.now() < deadline) await delay(10);
            assert.equal(sent.length, 1);
            await GroupMember.destroy({ where: { group_id: group.id, user_id: ids.viewer } });
            release();
            assert.deepEqual((await finished(data.requestId)).recipients, [
                { userId: ids.student, status: 'sent' },
                { userId: ids.viewer, status: 'failed' },
            ]);
            assert.equal(sent.length, 1);
        } finally {
            release();
            await GroupMember.findOrCreate({ where: { group_id: group.id, user_id: ids.viewer } });
        }
    });
    it('발송 중 서버가 중단된 기록도 재발송 없이 미시도와 결과 불명으로 마감한다', async () => {
        const key = crypto.randomUUID();
        await Broadcast.create({
            request_id: key,
            admin_id: ids.admin,
            input_hash: '0'.repeat(64),
        });
        await BroadcastDelivery.bulkCreate([
            { request_id: key, user_id: ids.student, status: 'pending', updated_at: new Date(0) },
            { request_id: key, user_id: ids.viewer, status: 'sending', updated_at: new Date(0) },
        ]);
        assert.deepEqual((await finished(key)).recipients, [
            { userId: ids.student, status: 'failed' },
            { userId: ids.viewer, status: 'unknown' },
        ]);
        assert.equal(sent.length, 0);
    });
});
