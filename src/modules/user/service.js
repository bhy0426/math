const { fail } = require('../../shared/helpers');
const { sequelize } = require('../../models');
const { findUser, publicUser } = require('../auth/account');
const { listFields, validateFields } = require('./member-fields.service');

async function edit(userId, body) {
    if (Object.keys(body).some((key) => !['nickname', 'email', 'username'].includes(key)))
        fail(400, '입력 항목을 확인하고 다시 제출하세요.');
    return sequelize.transaction(async (transaction) => {
        const fields = await listFields({ transaction, lock: transaction.LOCK.UPDATE });
        const account = await findUser(userId, { transaction });
        if (!account) fail(404, '회원이 없습니다.');
        const values = await validateFields(body, {
            partial: true,
            currentUser: account,
            fields,
            transaction,
        });
        if (!Object.keys(values).length) fail(400, '수정할 정보를 입력하세요.');
        await account.update(values, { transaction });
        return { message: '회원 정보 수정 완료', user: await publicUser(account, fields) };
    });
}

module.exports = { edit };
