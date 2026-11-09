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
const { pool, query } = require('../src/database');
const { initialize } = require('./seed');
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
        const [database] = await query('SELECT DATABASE() AS name');
        assert.equal(database.name, 'mathsite_test');
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
        [courseId] = (await query('SELECT id FROM courses ORDER BY id')).map((row) => row.id);
        [firstLecture, secondLecture] = (
            await query('SELECT id FROM lectures WHERE course_id = ? ORDER BY position', [courseId])
        ).map((row) => row.id);
    });

    after(async () => {
        if (server) {
            server.closeAllConnections();
            await new Promise((resolve) => server.close(resolve));
        }
        await pool.end();
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
            (await query('SELECT title FROM courses WHERE id = ?', [number]))[0].title,
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
        const [stored] = await query('SELECT video_file FROM lectures WHERE id = ?', [lectureId]);
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
            1,
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
        const registered = await fresh('POST', '/auth/register', {
            name: '신규 학생',
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
            (await fresh('PATCH', '/user', { name: '이름 변경' })).json.user.name,
            '이름 변경',
        );
        assert.equal(
            (
                await fresh('POST', '/auth/register', {
                    name: '중복',
                    email: 'new@mathsite.local',
                    password,
                })
            ).status,
            409,
        );
        await admin('DELETE', `/manager/users/${memberId}`);
        assert.equal((await fresh('GET', '/user')).status, 401);
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
        const response = await request('POST', '/auth/reset', { email: 'viewer@mathsite.local' });
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
