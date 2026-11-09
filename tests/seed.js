const fs = require('node:fs/promises');
const path = require('node:path');
const { query } = require('../src/database');
const { hashPassword, uploadDir } = require('../src/shared/helpers');
const { initialize: schema } = require('../scripts/init-db');

// 합성 계정과 영상은 테스트 전용 DB에서만 생성한다.
async function initialize() {
    if (process.env.DB_NAME !== 'mathsite_test') throw new Error('테스트 DB에서만 실행하세요.');
    await schema();
    const [existing] = await query('SELECT COUNT(*) AS total FROM users');
    if (existing.total) return { seeded: false };
    if (!process.env.TEST_PASSWORD) throw new Error('테스트 초기화 시 임시 비밀번호를 생성하세요.');
    const hash = await hashPassword(process.env.TEST_PASSWORD);
    const [adminRole] = await query("SELECT id FROM roles WHERE code = 'admin'");
    const [studentRole] = await query("SELECT id FROM roles WHERE code = 'student'");
    const admin = await query(
        "INSERT INTO users (name, email, password_hash, role_id, status) VALUES ('예제 원장', 'admin@mathsite.local', ?, ?, 'active')",
        [hash, adminRole.id],
    );
    const student = await query(
        "INSERT INTO users (name, email, password_hash, role_id, status) VALUES ('시청 허용 학생', 'student@mathsite.local', ?, ?, 'active')",
        [hash, studentRole.id],
    );
    await query(
        "INSERT INTO users (name, email, password_hash, role_id, status) VALUES ('시청 미허용 학생', 'viewer@mathsite.local', ?, ?, 'active')",
        [hash, studentRole.id],
    );
    const course = await query(
        "INSERT INTO courses (title, description, teacher) VALUES ('중등 수학 기초반', '강좌 안에 강의가 들어가는 구조를 확인하는 예제입니다.', '예제 원장')",
    );
    await fs.mkdir(uploadDir, { recursive: true });
    const lectures = [];
    for (const [index, title] of ['1강 — 정수와 유리수', '2강 — 문자와 식'].entries()) {
        const filename = `demo-${course.insertId}-${index + 1}.mp4`;
        await fs.copyFile(
            path.join(__dirname, 'fixtures/sample.mp4'),
            path.join(uploadDir, filename),
        );
        const lecture = await query(
            'INSERT INTO lectures (course_id, title, description, position, video_file, mime_type) VALUES (?, ?, ?, ?, ?, ?)',
            [
                course.insertId,
                title,
                '직접 생성한 2초 예제 영상입니다.',
                index + 1,
                filename,
                'video/mp4',
            ],
        );
        lectures.push(lecture.insertId);
    }
    await query(
        'INSERT INTO lecture_access (user_id, lecture_id, starts_at, expires_at, granted_by) VALUES (?, ?, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY), ?)',
        [student.insertId, lectures[0], admin.insertId],
    );
    await query(
        "INSERT INTO boards (title, content, author_id, is_pinned) VALUES ('학원 이용 안내', '학생은 관리자가 허용한 강의만 시청할 수 있습니다.', ?, TRUE)",
        [admin.insertId],
    );
    await query(
        "INSERT INTO questions (user_id, title, content, is_private) VALUES (?, '예제 질문', '관리자가 답변을 등록할 수 있나요?', TRUE)",
        [student.insertId],
    );
    return { seeded: true };
}

module.exports = { initialize };
