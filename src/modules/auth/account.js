const { User, Role } = require('../../models');
const { id } = require('../../shared/helpers');
const { listFields, selectFields } = require('../user/member-fields.service');

function findUser(userId, options = {}) {
    return User.findByPk(id(userId), { include: { model: Role, as: 'roleRecord' }, ...options });
}

async function publicUser(user, fields) {
    const value = user.get ? user.get({ plain: true }) : user;
    return {
        id: value.id,
        ...selectFields(value, fields || (await listFields())),
        status: value.status,
        roleId: value.role_id,
        role: value.roleRecord.code,
        roleName: value.roleRecord.name,
        canManage: Boolean(value.roleRecord.can_manage),
    };
}

module.exports = { findUser, publicUser };
