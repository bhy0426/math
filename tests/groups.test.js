const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { before, after, describe, it } = require('mocha');
require('./database-env');
process.env.TEST_PASSWORD = crypto.randomBytes(24).toString('hex');
process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const { sequelize, User, Course, Lecture, LectureAccess, GroupMember } = require('../src/models');
const { resetData } = require('./reset-data');
const { client } = require('./http-client');
const app = require('../src/app');

describe('회원 그룹과 강의 시청 권한 일괄 관리', () => {
    let server, admin, student, viewer, guest, member, other, owner, course;
    const path = '/manager/groups';

    async function newGroup(name, userIds = []) {
        const response = await admin('POST', path, { name });
        assert.equal(response.status, 201, response.json?.message);
        const url = path + '/' + response.json.group.id;
        if (userIds.length)
            assert.equal(
                (await admin('PATCH', url + '/members', { addUserIds: userIds })).status,
                200,
            );
        return url;
    }
    async function lecture(title) {
        return Lecture.create({ title, course_id: course.id, description: '테스트 강의' });
    }
    before(async () => {
        await resetData();
        [member, other, owner] = await Promise.all(
            ['student', 'viewer', 'admin'].map((username) => User.findOne({ where: { username } })),
        );
        course = await Course.findOne();
        server = app.listen(0, '127.0.0.1');
        await new Promise((resolve) => server.once('listening', resolve));
        const base = () => 'http://127.0.0.1:' + server.address().port;
        [admin, student, viewer, guest] = Array.from({ length: 4 }, () => client(base));
        for (const [request, username] of [
            [admin, 'admin'],
            [student, 'student'],
            [viewer, 'viewer'],
        ]) {
            const logged = await request('POST', '/auth/login', {
                identifier: username,
                password: process.env.TEST_PASSWORD,
            });
            assert.equal(logged.status, 200, logged.json?.message);
        }
    });
    after(async () => {
        if (server) {
            server.closeAllConnections();
            await new Promise((resolve) => server.close(resolve));
        }
        await sequelize.close();
    });

    it('그룹 조회·수정·일괄 권한 API는 관리자만 사용할 수 있다', async () => {
        for (const [request, status] of [
            [guest, 401],
            [student, 403],
        ]) {
            for (const [method, suffix] of [
                ['GET', ''],
                ['POST', ''],
                ['PATCH', '/1'],
                ['DELETE', '/1'],
                ['PATCH', '/1/members'],
                ['POST', '/1/access'],
            ]) {
                const result = await request(
                    method,
                    path + suffix,
                    method === 'GET' ? undefined : {},
                );
                assert.equal(result.status, status);
            }
        }
    });
    it('그룹 생성·이름 변경·중복 거절·삭제를 처리한다', async () => {
        assert.equal((await admin('POST', path, { name: '   ' })).status, 400);
        const url = await newGroup('초급반');
        assert.equal((await admin('PATCH', url, { name: '중급반' })).status, 200);
        assert.equal((await admin('POST', path, { name: '중급반' })).status, 409);
        assert.equal(
            (await admin('GET', path)).json.groups.find((group) => path + '/' + group.id === url)
                .name,
            '중급반',
        );
        assert.equal((await admin('DELETE', url)).status, 200);
        assert.equal((await admin('PATCH', url, { name: '상급반' })).status, 404);
    });
    it('학생은 여러 그룹에 배정할 수 있고 한 그룹의 변경이 다른 그룹에 영향을 주지 않는다', async () => {
        const left = await newGroup('월요일반', [member.id]);
        const right = await newGroup('수요일반', [member.id]);
        assert.equal(
            (await admin('PATCH', left + '/members', { addUserIds: [other.id, other.id] })).status,
            200,
        );
        assert.equal(
            (await admin('PATCH', left + '/members', { removeUserIds: [member.id] })).status,
            200,
        );
        const list = (await admin('GET', path)).json.groups;
        assert.deepEqual(list.find((row) => path + '/' + row.id === left).memberIds, [other.id]);
        assert.deepEqual(list.find((row) => path + '/' + row.id === right).memberIds, [member.id]);
        assert.equal(
            (await admin('PATCH', left + '/members', { addUserIds: [member.id, owner.id] })).status,
            409,
        );
        assert.equal(
            (
                await admin('PATCH', left + '/members', {
                    addUserIds: [member.id],
                    removeUserIds: [member.id],
                })
            ).status,
            400,
        );
        assert.equal(
            await GroupMember.count({ where: { group_id: Number(left.split('/').pop()) } }),
            1,
        );
    });
    it('선택한 학생·강의의 권한만 변경하고 개별 시청 API에도 즉시 적용한다', async () => {
        const url = await newGroup('심화반', [member.id, other.id]);
        const first = await lecture('도형');
        const second = await lecture('확률');
        const target = { userIds: [member.id], lectureIds: [first.id, second.id], action: 'grant' };
        const grant = await admin('POST', url + '/access', target);
        assert.equal(grant.status, 200, grant.json?.message);
        assert.equal(grant.json.studentCount, 1);
        assert.equal(grant.json.lectureCount, 2);
        const info = '/courses/' + course.id + '/lectures/' + first.id + '?info=1';
        assert.equal((await student('GET', info)).status, 200);
        assert.equal((await viewer('GET', info)).status, 403);
        const expiry = new Date(Date.now() + 86400000).toISOString();
        assert.equal(
            (await admin('POST', url + '/access', { ...target, expiresAt: expiry })).status,
            200,
        );
        const saved = await LectureAccess.findOne({
            where: { user_id: member.id, lecture_id: first.id },
        });
        assert.ok(Math.abs(saved.expires_at.getTime() - Date.parse(expiry)) < 1000);
        assert.equal(
            (
                await admin('POST', url + '/access', {
                    ...target,
                    lectureIds: [first.id],
                    action: 'revoke',
                })
            ).status,
            200,
        );
        assert.equal((await student('GET', info)).status, 403);
        assert.equal((await admin('DELETE', url)).status, 200);
        assert.equal(
            await GroupMember.count({ where: { group_id: Number(url.split('/').pop()) } }),
            0,
        );
        assert.equal(
            await LectureAccess.count({ where: { user_id: member.id, lecture_id: second.id } }),
            1,
        );
    });
    it('저장 직전 소속·승인·강의·기간을 검사하여 잘못된 일괄 작업 전체를 취소한다', async () => {
        const url = await newGroup('시험반', [member.id, other.id]);
        const item = await lecture('수열');
        const target = { userIds: [member.id, other.id], lectureIds: [item.id], action: 'grant' };
        assert.equal(
            (await admin('POST', url + '/access', { ...target, lectureIds: [item.id, 2147483647] }))
                .status,
            404,
        );
        assert.equal(
            (await admin('POST', url + '/access', { ...target, expiresAt: 'invalid' })).status,
            400,
        );
        assert.equal(
            (await admin('POST', url + '/access', { ...target, userIds: [] })).status,
            400,
        );
        await other.update({ status: 'suspended' });
        try {
            assert.equal((await admin('POST', url + '/access', target)).status, 409);
            assert.equal(
                (await admin('PATCH', url + '/members', { removeUserIds: [other.id] })).status,
                200,
            );
        } finally {
            await other.update({ status: 'active' });
        }
        assert.equal((await admin('POST', url + '/access', target)).status, 409);
        assert.equal(await LectureAccess.count({ where: { lecture_id: item.id } }), 0);
    });
});
