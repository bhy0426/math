const { Op } = require('sequelize');
const { Course, Lecture, LectureAccess } = require('../../models');
const { fail, id } = require('../../shared/helpers');

function accessWhere(userId) {
    const now = new Date();
    return { user_id: userId, starts_at: { [Op.lte]: now }, expires_at: { [Op.gt]: now } };
}

async function getCourse(courseId, user) {
    const course = await Course.findByPk(id(courseId));
    if (!course) fail(404, '강좌가 없습니다.');
    if (!user.canManage) {
        const lecture = await Lecture.findOne({
            where: { course_id: course.id, is_published: true },
            include: {
                model: LectureAccess,
                as: 'access',
                where: accessWhere(user.id),
                required: true,
            },
        });
        if (!course.is_published || !lecture) fail(403, '이 강좌에 접근할 권한이 없습니다.');
    }
    return course;
}

async function getLecture(courseId, lectureId, user) {
    await getCourse(courseId, user);
    const lecture = await Lecture.findOne({
        where: { id: id(lectureId), course_id: id(courseId) },
    });
    if (!lecture) fail(404, '해당 강좌의 강의가 아닙니다.');
    if (!user.canManage) {
        const grant = await LectureAccess.findOne({
            where: { ...accessWhere(user.id), lecture_id: lecture.id },
        });
        if (!lecture.is_published || !grant) fail(403, '이 강의의 시청 권한이 없습니다.');
    }
    return lecture;
}

function publicLecture(lecture) {
    const { video_file, mime_type, hls_key, video_status, ...safe } = lecture.get
        ? lecture.get({ plain: true })
        : lecture;
    return {
        ...safe,
        videoStatus: video_file
            ? video_status === 'NO_VIDEO'
                ? 'ORIGINAL'
                : video_status || 'ORIGINAL'
            : 'NO_VIDEO',
    };
}

module.exports = { accessWhere, getCourse, getLecture, publicLecture };
