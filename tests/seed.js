const fs = require('node:fs/promises');
const path = require('node:path');
const {
    sequelize,
    Role,
    User,
    Course,
    Lecture,
    LectureAccess,
    Board,
    Question,
} = require('../src/models');
const { hashPassword } = require('../src/modules/auth/password');
const { uploadDir } = require('../src/shared/helpers');
const { initialize: schema } = require('../scripts/init-db');

async function initialize() {
    if (sequelize.config.database !== 'mathsite_test')
        throw new Error('테스트 DB에서만 실행하세요.');
    await schema();
    if (await User.count()) return { seeded: false };
    if (!process.env.TEST_PASSWORD) throw new Error('시험 비밀번호를 준비하세요.');
    const hash = await hashPassword(process.env.TEST_PASSWORD);
    const adminRole = await Role.findOne({ where: { code: 'admin' } });
    const studentRole = await Role.findOne({ where: { code: 'student' } });
    const admin = await User.create({
        nickname: '예제 원장',
        username: 'admin',
        email: 'admin@mathsite.local',
        password_hash: hash,
        role_id: adminRole.id,
        status: 'active',
    });
    const student = await User.create({
        nickname: '시청 허용 학생',
        username: 'student',
        email: 'student@mathsite.local',
        password_hash: hash,
        role_id: studentRole.id,
        status: 'active',
    });
    await User.create({
        nickname: '시청 미허용 학생',
        username: 'viewer',
        email: 'viewer@mathsite.local',
        password_hash: hash,
        role_id: studentRole.id,
        status: 'active',
    });
    const course = await Course.create({
        title: '중등 수학 기초반',
        description: '강좌 안에 강의가 들어가는 구조를 확인하는 예제입니다.',
        teacher: '예제 원장',
    });
    await fs.mkdir(uploadDir, { recursive: true });
    const lectures = [];
    for (const [index, title] of ['1강 — 정수와 유리수', '2강 — 문자와 식'].entries()) {
        const filename = `sample-${course.id}-${index + 1}.mp4`;
        await fs.copyFile(
            path.join(__dirname, 'fixtures/sample.mp4'),
            path.join(uploadDir, filename),
        );
        const lecture = await Lecture.create({
            course_id: course.id,
            title,
            description: '직접 생성한 2초 예제 영상입니다.',
            position: index + 1,
            video_file: filename,
            mime_type: 'video/mp4',
            video_status: 'ORIGINAL',
        });
        lectures.push(lecture.id);
    }
    await LectureAccess.create({
        user_id: student.id,
        lecture_id: lectures[0],
        starts_at: new Date(Date.now() - 86400000),
        expires_at: new Date(Date.now() + 30 * 86400000),
        granted_by: admin.id,
    });
    await Board.create({
        title: '학원 이용 안내',
        content: '학생은 관리자가 허용한 강의만 시청할 수 있습니다.',
        author_id: admin.id,
        is_pinned: true,
    });
    await Question.create({
        user_id: student.id,
        title: '예제 질문',
        content: '관리자가 답변을 등록할 수 있나요?',
        is_private: true,
        answer: null,
    });
    return { seeded: true };
}

module.exports = { initialize };
