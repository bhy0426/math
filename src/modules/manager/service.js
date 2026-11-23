const { Op } = require('sequelize');
const { sequelize, User, Role } = require('../../models');
const { id, fail } = require('../../shared/helpers');
const { findUser, publicUser } = require('../auth/account');
const { listFields } = require('../user/member-fields.service');
const profile = require('../user/service');
const { getRole } = require('./roles.service');

async function getUser(value) {
    const account = await findUser(value);
    if (!account) fail(404, '회원이 없습니다.');
    return publicUser(account);
}

async function listUsers() {
    const fields = await listFields();
    const rows = await User.findAll({
        include: { model: Role, as: 'roleRecord' },
        order: [['id', 'ASC']],
    });
    return { users: await Promise.all(rows.map((user) => publicUser(user, fields))) };
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
        if (changes.role?.id === account.role_id || changes.status === account.status) return;
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
    const role = await getRole(body.roleId);
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
module.exports = { getUser, editUser, listUsers, userRole, changeRole, changeStatus, removeUser };
