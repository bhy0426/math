const { describe, it, before, after } = require('mocha');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
require('./database-env');

// 개발 DB나 다른 프로젝트 DB를 지우지 않는다.
process.env.TEST_PASSWORD = crypto.randomBytes(24).toString('hex');
process.env.UPLOAD_DIR = path.resolve('.local/test-uploads');
process.env.RESET_MAIL_DIR = path.resolve('.local/test-reset-mail');
process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const { sequelize, Course, Lecture } = require('../src/models');
const { resetData } = require('./reset-data');
const { openMailbox, closeMailbox, registerByEmail } = require('./signup-mail');
const app = require('../src/app');
let server, base, admin, student, viewer, fixture;
let adminId, studentId, viewerId, courseId, firstLecture, secondLecture;

const { client: httpClient } = require('./http-client');
function client() {
    return httpClient(() => base);
}

async function login(request, address, password = process.env.TEST_PASSWORD) {
    const result = await request('POST', '/auth/login', { email: address, password });
    assert.equal(result.status, 200, result.json?.message);
    return result.json.user;
}

describe('학원 사이트 API 통합 테스트', function () {
    before(async () => {
        await openMailbox();
        await resetData();
        fixture = await fs.readFile(path.join(__dirname, 'fixtures/sample.mp4'));
        server = app.listen(0, '127.0.0.1');
        await new Promise((resolve) => server.once('listening', resolve));
        base = `http://127.0.0.1:${server.address().port}`;
        admin = client();
        student = client();
        viewer = client();
        adminId = (await login(admin, 'admin@mathsite.local')).id;
        studentId = (await login(student, 'student@mathsite.local')).id;
        viewerId = (await login(viewer, 'viewer@mathsite.local')).id;
        [courseId] = (
            await Course.findAll({ attributes: ['id'], order: [['id', 'ASC']], raw: true })
        ).map((row) => row.id);
        [firstLecture, secondLecture] = (
            await Lecture.findAll({
                where: { course_id: courseId },
                order: [['position', 'ASC']],
                raw: true,
            })
        ).map((row) => row.id);
    });

    after(async () => {
        await closeMailbox();
        await require('../src/modules/courses/video').waitForConversions();
        if (server) {
            server.closeAllConnections();
            await new Promise((resolve) => server.close(resolve));
        }
        await sequelize.close();
        for (const directory of [process.env.UPLOAD_DIR, process.env.RESET_MAIL_DIR]) {
            const resolved = path.resolve(directory);
            assert.ok(
                [
                    path.resolve('.local/test-uploads'),
                    path.resolve('.local/test-reset-mail'),
                ].includes(resolved),
            );
            await fs.rm(resolved, { recursive: true, force: true });
        }
    });

    it('React 화면의 직접 주소·새로고침과 빌드 자산 제공, API 404 분리', async () => {
        for (const url of ['/', '/login', '/courses/1', '/courses/1/lectures/1', '/manager']) {
            const response = await fetch(base + url);
            assert.equal(response.status, 200, url);
            assert.match(response.headers.get('content-type'), /text\/html/);
            const html = await response.text();
            assert.match(html, /<div id="root"><\/div>/);
            const asset = html.match(/src="(\/assets\/[^\"]+\.js)"/)[1];
            assert.equal((await fetch(base + asset)).status, 200);
        }
        const missing = await fetch(base + '/api/does-not-exist');
        assert.equal(missing.status, 404);
        assert.match(missing.headers.get('content-type'), /application\/json/);
        assert.equal((await fetch(base + '/.env')).status, 404);
    });

    it('서버 상태, 비로그인 차단, 세션 로그인·로그아웃', async () => {
        const guest = client();
        assert.equal((await guest('GET', '/health')).json.database, 'MySQL 연결 완료');
        assert.equal((await guest('GET', '/auth/status')).json.loggedIn, false);
        assert.equal((await guest('GET', '/courses')).status, 401);
        assert.equal(
            (
                await guest('POST', '/auth/login', {
                    email: 'admin@mathsite.local',
                    password: 'wrong',
                })
            ).status,
            401,
        );
        await login(guest, 'student@mathsite.local');
        assert.equal((await guest('GET', '/user')).json.user.role, 'student');
        await guest('POST', '/auth/logout');
        assert.equal((await guest('GET', '/user')).status, 401);
    });

    it('강좌 목록 필터, 관리자 CRUD, 학생 수정 차단, MySQL 저장', async () => {
        assert.equal((await viewer('GET', '/courses')).json.courses.length, 0);
        assert.equal((await viewer('GET', `/courses/${courseId}`)).status, 403);
        assert.equal((await student('GET', '/courses')).json.courses.length, 1);
        assert.equal(
            (await student('POST', '/courses', { title: '위조', description: '위조' })).status,
            403,
        );
        const created = await admin('POST', '/courses', {
            title: '검증용 강좌',
            description: '별도 테스트 DB',
            teacher: '테스트 강사',
        });
        assert.equal(created.status, 201);
        const number = created.json.course.id;
        assert.equal(
            (await Course.findAll({ where: { id: number }, raw: true }))[0].title,
            '검증용 강좌',
        );
        assert.equal(
            (await admin('PATCH', `/courses/${number}`, { title: '수정된 강좌' })).json.course
                .title,
            '수정된 강좌',
        );
        assert.equal((await student('PATCH', `/courses/${number}`, { title: '위조' })).status, 403);
        assert.equal(
            (await admin('GET', '/courses?q=%27%20OR%201%3D1%20--')).json.courses.length,
            0,
        );
        assert.equal((await admin('DELETE', `/courses/${number}`)).status, 200);
        assert.equal((await admin('GET', `/courses/${number}`)).status, 404);
    });

    it('같은 학생 역할도 영상별 허용·미허용·만료·미게시 여부로 구분', async () => {
        assert.equal(
            (await student('GET', `/courses/${courseId}/lectures`)).json.lectures.length,
            1,
        );
        const info = await student('GET', `/courses/${courseId}/lectures/${firstLecture}?info=1`);
        assert.equal(info.status, 200);
        assert.equal('video_file' in info.json.lecture, false);
        assert.equal(
            (await student('GET', `/courses/${courseId}/lectures/${secondLecture}?info=1`)).status,
            403,
        );
        assert.equal(
            (await viewer('GET', `/courses/${courseId}/lectures/${firstLecture}`)).status,
            403,
        );
        await admin('POST', `/manager/users/${studentId}/lectures`, {
            lectureId: secondLecture,
            startsAt: '2020-01-01T00:00:00Z',
            expiresAt: '2020-02-01T00:00:00Z',
        });
        assert.equal(
            (await student('POST', `/courses/${courseId}/lectures/${secondLecture}/playback`))
                .status,
            403,
        );
        await admin('PATCH', `/courses/${courseId}/lectures/${firstLecture}`, {
            isPublished: false,
        });
        assert.equal(
            (await student('GET', `/courses/${courseId}/lectures/${firstLecture}`)).status,
            403,
        );
        await admin('PATCH', `/courses/${courseId}/lectures/${firstLecture}`, {
            isPublished: true,
        });
        await admin('PATCH', `/courses/${courseId}/status`, { isPublished: false });
        assert.equal((await student('GET', `/courses/${courseId}`)).status, 403);
        await admin('PATCH', `/courses/${courseId}/status`, { isPublished: true });
    });

    it('실제 영상 업로드·부분 재생·권한 부여와 회수·다른 강좌 ID 차단', async () => {
        const form = new FormData();
        form.set('title', '업로드 검증 영상');
        form.set('video', new Blob([fixture], { type: 'video/mp4' }), 'sample.mp4');
        const result = await admin('POST', `/courses/${courseId}/lectures`, form);
        assert.equal(result.status, 201, result.json?.message);
        const lectureId = result.json.lecture.id;
        const url = `/courses/${courseId}/lectures/${lectureId}`;
        assert.equal((await student('POST', url + '/playback')).status, 403);
        const grant = await admin('POST', `/manager/users/${studentId}/lectures`, { lectureId });
        assert.equal(grant.status, 201);
        assert.equal((await student('POST', url + '/playback')).status, 200);
        const range = await student('GET', url, undefined, { Range: 'bytes=0-99' });
        assert.equal(range.status, 206);
        assert.equal(range.headers.get('content-range'), `bytes 0-99/${fixture.length}`);
        assert.deepEqual(range.bytes, fixture.subarray(0, 100));
        const suffix = await student('GET', url, undefined, { Range: 'bytes=-40' });
        assert.deepEqual(suffix.bytes, fixture.subarray(-40));
        assert.equal(
            (await student('GET', url, undefined, { Range: 'bytes=999999-' })).status,
            416,
        );
        assert.equal((await admin('PATCH', url, { title: '제목 변경' })).status, 200);
        assert.equal((await admin('PATCH', url, { description: '' })).status, 200);
        const other = await admin('POST', '/courses', {
            title: '다른 강좌',
            description: '범위 확인',
        });
        assert.equal(
            (await admin('GET', `/courses/${other.json.course.id}/lectures/${lectureId}`)).status,
            404,
        );
        await admin('DELETE', `/courses/${other.json.course.id}`);
        await admin('DELETE', `/manager/users/${studentId}/lectures/${lectureId}`);
        assert.equal((await student('GET', url)).status, 403);
        const [stored] = await Lecture.findAll({ where: { id: lectureId }, raw: true });
        assert.equal((await admin('DELETE', url)).status, 200);
        await assert.rejects(fs.stat(path.join(process.env.UPLOAD_DIR, stored.video_file)), {
            code: 'ENOENT',
        });
    });

    it('학생 업로드·권한 자체 부여 차단과 위장 파일 검증', async () => {
        assert.equal(
            (await student('POST', `/courses/${courseId}/lectures`, { title: '불가' })).status,
            403,
        );
        assert.equal(
            (
                await student('POST', `/manager/users/${studentId}/lectures`, {
                    lectureId: secondLecture,
                })
            ).status,
            403,
        );
        const form = new FormData();
        form.set('title', '위장 파일');
        form.set('video', new Blob(['not a video'], { type: 'video/mp4' }), 'fake.mp4');
        assert.equal((await admin('POST', `/courses/${courseId}/lectures`, form)).status, 400);
        assert.equal((await admin('GET', '/lectures/1')).status, 404);
    });

    it('공지 관리자 CRUD·고정, 학생 작성·수정·삭제 거절', async () => {
        assert.equal(
            (await student('POST', '/boards', { title: '불가', content: '불가' })).status,
            403,
        );
        const created = await admin('POST', '/boards', { title: '시험 공지', content: '내용' });
        const boardId = created.json.board.id;
        assert.equal((await student('GET', `/boards/${boardId}`)).status, 200);
        assert.equal((await student('PATCH', `/boards/${boardId}`, { title: '불가' })).status, 403);
        assert.equal(
            (await admin('PATCH', `/boards/${boardId}`, { title: '수정 공지' })).json.board.title,
            '수정 공지',
        );
        assert.equal(
            (await admin('PATCH', `/boards/${boardId}/pin`, { isPinned: true })).json.board
                .is_pinned,
            true,
        );
        assert.equal((await student('DELETE', `/boards/${boardId}`)).status, 403);
        assert.equal((await admin('DELETE', `/boards/${boardId}`)).status, 200);
    });

    it('Q&A 비공개, 작성자 수정, 관리자 답변 등록·수정·삭제', async () => {
        const created = await student('POST', '/info/qna', {
            title: '비공개 질문',
            content: '질문 내용',
        });
        const questionId = created.json.question.id;
        assert.equal((await viewer('GET', `/info/qna/${questionId}`)).status, 403);
        assert.equal(
            (await viewer('GET', '/info/qna')).json.questions.some((row) => row.id === questionId),
            false,
        );
        assert.equal(
            (await viewer('PATCH', `/info/qna/${questionId}`, { title: '불가' })).status,
            403,
        );
        assert.equal(
            (await student('PATCH', `/info/qna/${questionId}`, { title: '질문 수정' })).status,
            200,
        );
        assert.equal(
            (await student('POST', `/info/qna/${questionId}/answer`, { answer: '불가' })).status,
            403,
        );
        assert.equal(
            (await admin('POST', `/info/qna/${questionId}/answer`, { answer: '원장 답변' })).status,
            201,
        );
        assert.equal(
            (await student('GET', `/info/qna/${questionId}`)).json.question.answer,
            '원장 답변',
        );
        assert.equal(
            (await admin('PATCH', `/info/qna/${questionId}/answer`, { answer: '수정 답변' }))
                .status,
            200,
        );
        assert.equal((await admin('DELETE', `/info/qna/${questionId}/answer`)).status, 200);
        assert.equal((await student('DELETE', `/info/qna/${questionId}`)).status, 200);
    });

    it('회원가입은 승인 대기, 역할 위조 불가, 관리자 승인 후 로그인', async () => {
        const fresh = client();
        const password = crypto.randomBytes(16).toString('hex');
        const registered = await registerByEmail(fresh, {
            nickname: '신규 학생',
            username: 'new_student',
            email: 'new@mathsite.local',
            password,
            role: 'admin',
        });
        assert.equal(registered.status, 201);
        const memberId = registered.json.user.id;
        assert.equal(
            (await fresh('POST', '/auth/login', { email: 'new@mathsite.local', password })).status,
            403,
        );
        assert.equal(
            (await admin('PATCH', `/manager/users/${memberId}/status`, { status: 'active' }))
                .status,
            200,
        );
        assert.equal((await login(fresh, 'new@mathsite.local', password)).role, 'student');
        assert.equal((await fresh('PATCH', '/user', { role: 'admin' })).status, 400);
        assert.equal(
            (await fresh('PATCH', '/user', { nickname: '닉네임 변경' })).json.user.nickname,
            '닉네임 변경',
        );
        assert.equal(
            (
                await client()('POST', '/auth/register/code', {
                    nickname: '중복',
                    username: 'duplicate_student',
                    email: 'new@mathsite.local',
                    password,
                })
            ).status,
            409,
        );
        await admin('DELETE', `/manager/users/${memberId}`);
        assert.equal((await fresh('GET', '/user')).status, 401);
    });

    it('같은 회원 상태·역할을 다시 저장해도 학생 로그인은 유지된다', async () => {
        const profile = (await viewer('GET', '/user')).json.user;
        assert.equal(
            (await admin('PATCH', `/manager/users/${viewerId}/status`, { status: profile.status }))
                .status,
            200,
        );
        assert.equal(
            (await admin('PATCH', `/manager/users/${viewerId}/role`, { roleId: profile.roleId }))
                .status,
            200,
        );
        assert.equal((await viewer('GET', '/user')).status, 200);
    });

    it('개별 시청 권한도 활성 학생에게만 부여하고 정지 상태에서 기존 권한을 회수할 수 있다', async () => {
        const item = await Lecture.create({
            course_id: courseId,
            title: '개별 시청 권한 검사',
            description: '',
        });
        const body = { lectureId: item.id };
        const access = `/manager/users/${viewerId}/lectures`;
        const status = `/manager/users/${viewerId}/status`;
        try {
            assert.equal(
                (await admin('POST', `/manager/users/${adminId}/lectures`, body)).status,
                409,
            );
            await admin('PATCH', status, { status: 'pending' });
            assert.equal((await admin('POST', access, body)).status, 409);
            assert.ok(
                !(await admin('GET', access)).json.access.some((row) => row.lecture_id === item.id),
            );
            await admin('PATCH', status, { status: 'active' });
            assert.equal((await admin('POST', access, body)).status, 201);
            await admin('PATCH', status, { status: 'suspended' });
            assert.equal((await admin('POST', access, body)).status, 409);
            assert.equal((await admin('DELETE', access + '/' + item.id)).status, 200);
        } finally {
            await admin('PATCH', status, { status: 'active' });
            await login(viewer, 'viewer@mathsite.local');
            await item.destroy();
        }
    });

    it('정지·역할 변경은 기존 세션에도 반영, 마지막 관리자 보호', async () => {
        await admin('PATCH', `/manager/users/${viewerId}/status`, { status: 'suspended' });
        assert.equal((await viewer('GET', '/user')).status, 401);
        await admin('PATCH', `/manager/users/${viewerId}/status`, { status: 'active' });
        await login(viewer, 'viewer@mathsite.local');
        const roles = (await admin('GET', '/manager')).json.roles;
        const studentRole = roles.find((role) => role.code === 'student');
        assert.equal((await admin('DELETE', `/manager/users/${adminId}`)).status, 409);
        assert.equal(
            (await admin('PATCH', `/manager/users/${adminId}/status`, { status: 'suspended' }))
                .status,
            409,
        );
        assert.equal(
            (await admin('PATCH', `/manager/users/${adminId}/role`, { roleId: studentRole.id }))
                .status,
            409,
        );
        const created = await admin('POST', '/manager', { code: 'assistant', name: '보조 학생' });
        assert.equal(created.status, 201);
        const roleId = created.json.roleId;
        assert.equal((await admin('PATCH', '/manager', { roleId, name: '보조 역할' })).status, 200);
        assert.equal(
            (await admin('PATCH', `/manager/users/${viewerId}/role`, { roleId })).status,
            200,
        );
        assert.equal((await viewer('GET', '/user')).status, 401);
        assert.equal((await admin('DELETE', '/manager', { roleId })).status, 409);
        await admin('PATCH', `/manager/users/${viewerId}/role`, { roleId: studentRole.id });
        assert.equal((await admin('DELETE', '/manager', { roleId })).status, 200);
        await login(viewer, 'viewer@mathsite.local');
    });

    it('비밀번호 재설정 토큰 비노출·일회용, 변경 후 기존 세션 무효화', async () => {
        const request = client();
        await login(request, 'viewer@mathsite.local');
        const response = await admin('POST', `/manager/users/${viewerId}/password-reset`);
        assert.equal((await request('GET', '/user')).status, 401);
        assert.equal(response.status, 200);
        assert.equal('token' in response.json, false);
        const files = await fs.readdir(process.env.RESET_MAIL_DIR);
        const mail = JSON.parse(
            await fs.readFile(
                path.join(process.env.RESET_MAIL_DIR, files[files.length - 1]),
                'utf8',
            ),
        );
        const password = crypto.randomBytes(16).toString('hex');
        assert.equal(
            (await request('POST', '/auth/reset', { token: mail.token, password })).status,
            200,
        );
        assert.equal((await request('GET', '/auth/status')).json.loggedIn, false);
        assert.equal(
            (await request('POST', '/auth/reset', { token: mail.token, password })).status,
            400,
        );
        assert.equal(
            (
                await request('POST', '/auth/login', {
                    email: 'viewer@mathsite.local',
                    password: process.env.TEST_PASSWORD,
                })
            ).status,
            401,
        );
        await login(request, 'viewer@mathsite.local', password);
    });

    it('다른 출처 변경 요청과 잘못된 입력을 거절', async () => {
        assert.equal(
            (
                await admin(
                    'POST',
                    '/boards',
                    { title: '불가', content: '불가' },
                    { Origin: 'https://example.invalid' },
                )
            ).status,
            403,
        );
        assert.equal((await admin('POST', '/courses', {})).status, 400);
        assert.equal((await admin('GET', '/courses/not-a-number')).status, 400);
    });
});
