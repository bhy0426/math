const { Op } = require('sequelize');
const { Course, Lecture, LectureAccess } = require('../../models');
const { text, bool, removeVideo } = require('../../shared/helpers');
const { getCourse, accessWhere } = require('./access');
const { cancelConversion, removeHls } = require('./video');

async function list(query, user) {
    const search = typeof query.q === 'string' ? query.q.slice(0, 160) : '';
    const where = { title: { [Op.like]: `%${search}%` } };
    if (!user.canManage) {
        const grants = await LectureAccess.findAll({
            where: accessWhere(user.id),
            include: {
                model: Lecture,
                as: 'lecture',
                where: { is_published: true },
                required: true,
            },
        });
        where.id = { [Op.in]: [...new Set(grants.map((grant) => grant.lecture.course_id))] };
        where.is_published = true;
    }
    return { courses: await Course.findAll({ where, order: [['id', 'DESC']] }) };
}
async function detail(courseId, user) {
    return { course: await getCourse(courseId, user) };
}
async function create(body) {
    const course = await Course.create({
        title: text(body.title, '강좌명'),
        description: text(body.description, '강좌 설명', 10000),
        teacher:
            body.teacher === undefined || body.teacher === ''
                ? ''
                : text(body.teacher, '강사 이름', 80),
        is_published: body.isPublished === undefined ? true : bool(body.isPublished),
    });
    return { message: '강좌 등록 완료', course };
}
async function edit(courseId, body, user) {
    const course = await getCourse(courseId, user);
    const changes = {};
    if (body.title !== undefined) changes.title = text(body.title, '강좌명');
    if (body.description !== undefined)
        changes.description = text(body.description, '강좌 설명', 10000);
    if (body.teacher !== undefined)
        changes.teacher = body.teacher === '' ? '' : text(body.teacher, '강사 이름', 80);
    if (body.isPublished !== undefined) changes.is_published = bool(body.isPublished);
    await course.update(changes);
    return { message: '강좌 수정 완료', course };
}
async function remove(courseId, user) {
    const course = await getCourse(courseId, user);
    const lectures = await Lecture.findAll({ where: { course_id: course.id } });
    await Promise.all(lectures.map((lecture) => cancelConversion(lecture.id)));
    await course.destroy();
    await Promise.all(
        lectures.map(async (lecture) => {
            await removeVideo(lecture.video_file);
            await removeHls(lecture.hls_key);
        }),
    );
    return { message: '강좌 삭제 완료' };
}
async function changeStatus(courseId, body, user) {
    const result = await edit(courseId, { isPublished: bool(body.isPublished) }, user);
    return { ...result, message: '강좌 공개 상태 변경 완료' };
}

module.exports = { list, detail, create, edit, remove, changeStatus };
