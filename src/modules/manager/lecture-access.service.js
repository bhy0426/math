const { sequelize, Lecture, LectureAccess } = require('../../models');
const { id, fail } = require('../../shared/helpers');
const { findUser } = require('../auth/account');
const { accessPeriod } = require('../courses/access');

async function listAccess(userId) {
    if (!(await findUser(userId))) fail(404, '회원이 없습니다.');
    const rows = await LectureAccess.findAll({
        where: { user_id: id(userId) },
        include: { model: Lecture, as: 'lecture' },
        order: [['lecture_id', 'ASC']],
    });
    const now = new Date();
    return {
        access: rows.map((row) => ({
            lecture_id: row.lecture_id,
            course_id: row.lecture.course_id,
            title: row.lecture.title,
            starts_at: row.starts_at,
            expires_at: row.expires_at,
            valid: row.starts_at <= now && row.expires_at > now,
        })),
    };
}
// 개인·그룹 부여 모두 같은 학생·강의 행에 기간과 부여자를 저장한다.
function saveLectureGrants(lectureId, userIds, period, adminId, transaction) {
    const rows = userIds.map((userId) => ({
        user_id: userId,
        lecture_id: lectureId,
        starts_at: period.starts,
        expires_at: period.expires,
        granted_by: adminId,
    }));
    return LectureAccess.bulkCreate(rows, {
        transaction,
        updateOnDuplicate: ['starts_at', 'expires_at', 'granted_by'],
    });
}

async function grantAccess(userId, body, adminId) {
    const studentId = id(userId);
    const lectureId = id(body.lectureId);
    const period = accessPeriod(body);
    await sequelize.transaction(async (transaction) => {
        const lookup = { transaction, lock: transaction.LOCK.SHARE };
        const student = await findUser(studentId, lookup);
        if (!student) fail(404, '회원이 없습니다.');
        if (student.status !== 'active' || student.roleRecord.can_manage)
            fail(409, '승인된 학생에게만 시청 권한을 부여할 수 있습니다.');
        if (!(await Lecture.findByPk(lectureId, lookup))) fail(404, '강의가 없습니다.');
        await saveLectureGrants(lectureId, [studentId], period, adminId, transaction);
    });
    return {
        message: '강의 시청 권한 부여 완료',
        userId: studentId,
        lectureId,
        startsAt: period.starts,
        expiresAt: period.expires,
    };
}
async function revokeAccess(userId, lectureId) {
    if (
        !(await LectureAccess.destroy({
            where: { user_id: id(userId), lecture_id: id(lectureId) },
        }))
    )
        fail(404, '부여된 시청 권한이 없습니다.');
    return { message: '강의 시청 권한 회수 완료' };
}

module.exports = { listAccess, grantAccess, revokeAccess, saveLectureGrants };
