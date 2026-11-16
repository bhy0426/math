const { Role } = require('../../models');
const { text, id, fail } = require('../../shared/helpers');

async function getRole(roleId) {
    const role = await Role.findByPk(id(roleId));
    if (!role) fail(404, '역할이 없습니다.');
    return role;
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
    const role = await getRole(body.roleId);
    await role.update({ name: text(body.name, '역할 이름', 80) });
    return { message: '역할 이름 수정 완료' };
}
async function removeRole(body) {
    const role = await getRole(body.roleId);
    if (['admin', 'student'].includes(role.code)) fail(409, '기본 역할은 삭제할 수 없습니다.');
    await role.destroy();
    return { message: '역할 삭제 완료' };
}

module.exports = { getRole, listRoles, createRole, editRole, removeRole };
