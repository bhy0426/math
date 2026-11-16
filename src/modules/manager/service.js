const { Op } = require('sequelize');
const { sequelize, User, Role, Lecture, LectureAccess } = require('../../models');
const { text, id, fail } = require('../../shared/helpers');
const { findUser, publicUser } = require('../auth/account');
const { requestAdminReset } = require('../auth/service');
const { listFields } = require('./member-fields.service');
const profile = require('../user/service');

async function getUser(value) {
    const account = await findUser(value);
    if (!account) fail(404, '회원이 없습니다.');
    return publicUser(account);
}

async function listUsers() {
    const fields = await listFields();
    return {
        users: await Promise.all(
            (
                await User.findAll({
                    include: { model: Role, as: 'roleRecord' },
                    order: [['id', 'ASC']],
                })
            ).map((user) => publicUser(user, fields)),
        ),
    };
}
async function editUser(userId, body) {
    await getUser(userId);
    return profile.edit(id(userId), body);
}
async function userRole(value) {
    const user = await getUser(value);
    return { userId: user.id, roleId: user.roleId, role: user.role, roleName: user.roleName };
}

async function changeUser(value, changes) {
    await sequelize.transaction(async (transaction) => {
        await User.findAll({
            attributes: ['id'],
            order: [['id', 'ASC']],
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        const account = await User.findByPk(id(value), {
            include: { model: Role, as: 'roleRecord' },
            transaction,
        });
        if (!account) fail(404, '회원이 없습니다.');
        const managedRoles = await Role.findAll({ where: { can_manage: true }, transaction });
        const admins = await User.count({
            where: { status: 'active', role_id: { [Op.in]: managedRoles.map((role) => role.id) } },
            transaction,
        });
        const removesAdmin =
            changes.remove ||
            (changes.status && changes.status !== 'active') ||
            (changes.role && !changes.role.can_manage);
        if (
            account.roleRecord.can_manage &&
            account.status === 'active' &&
            removesAdmin &&
            admins <= 1
        )
            fail(409, '마지막 관리자는 삭제·정지·역할 변경할 수 없습니다.');
        if (changes.remove) await account.destroy({ transaction });
        else
            await account.update(
                {
                    ...(changes.role ? { role_id: changes.role.id } : { status: changes.status }),
                    session_version: account.session_version + 1,
                },
                { transaction },
            );
    });
}

async function changeRole(userId, body) {
    const role = await Role.findByPk(id(body.roleId));
    if (!role) fail(404, '역할이 없습니다.');
    await changeUser(userId, { role });
    return { message: '회원 역할 변경 완료', user: await getUser(userId) };
}
async function changeStatus(userId, body) {
    if (!['pending', 'active', 'suspended'].includes(body.status))
        fail(400, '상태는 pending, active, suspended 중 하나입니다.');
    await changeUser(userId, { status: body.status });
    return { message: '회원 상태 변경 완료', user: await getUser(userId) };
}
async function removeUser(userId) {
    await changeUser(userId, { remove: true });
    return { message: '회원 삭제 완료' };
}
async function listRoles() {
    return { roles: await Role.findAll({ order: [['id', 'ASC']] }) };
}
async function createRole(body) {
    const code = text(body.code, '역할 코드', 40);
    if (!/^[a-z][a-z0-9_]{1,39}$/.test(code))
        fail(400, '역할 코드는 영문 소문자·숫자·밑줄로 입력하세요.');
    const role = await Role.create({ code, name: text(body.name, '역할 이름', 80) });
    return { message: '역할 추가 완료', roleId: role.id };
}
async function editRole(body) {
    const role = await Role.findByPk(id(body.roleId));
    if (!role) fail(404, '역할이 없습니다.');
    await role.update({ name: text(body.name, '역할 이름', 80) });
    return { message: '역할 이름 수정 완료' };
}
async function removeRole(body) {
    const role = await Role.findByPk(id(body.roleId));
    if (!role) fail(404, '역할이 없습니다.');
    if (['admin', 'student'].includes(role.code)) fail(409, '기본 역할은 삭제할 수 없습니다.');
    await role.destroy();
    return { message: '역할 삭제 완료' };
}

async function listAccess(userId) {
    await getUser(userId);
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
async function grantAccess(userId, body, adminId) {
    await getUser(userId);
    const lectureId = id(body.lectureId);
    if (!(await Lecture.findByPk(lectureId))) fail(404, '강의가 없습니다.');
    const starts = body.startsAt ? new Date(body.startsAt) : new Date(Date.now() - 1000);
    const expires = body.expiresAt
        ? new Date(body.expiresAt)
        : new Date(Date.now() + 30 * 86400000);
    if (
        !Number.isFinite(starts.getTime()) ||
        !Number.isFinite(expires.getTime()) ||
        expires <= starts
    )
        fail(400, '유효한 시작일과 만료일을 입력하세요.');
    await LectureAccess.upsert({
        user_id: id(userId),
        lecture_id: lectureId,
        starts_at: starts,
        expires_at: expires,
        granted_by: adminId,
    });
    return {
        message: '강의 시청 권한 부여 완료',
        userId: id(userId),
        lectureId,
        startsAt: starts,
        expiresAt: expires,
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

module.exports = {
    getUser,
    editUser,
    listUsers,
    userRole,
    changeRole,
    changeStatus,
    removeUser,
    listRoles,
    createRole,
    editRole,
    removeRole,
    listAccess,
    grantAccess,
    revokeAccess,
    requestAdminReset,
};
