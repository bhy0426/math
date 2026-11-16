const { fail } = require('../../shared/helpers');
const { findUser, publicUser } = require('../auth/account');
const { validateFields } = require('../manager/member-fields.service');

async function edit(userId, body) {
    if (Object.keys(body).some((key) => !['nickname', 'email', 'username'].includes(key)))
        fail(400, '입력 항목을 확인하고 다시 제출하세요.');
    const account = await findUser(userId);
    const values = await validateFields(body, { partial: true, currentUser: account });
    if (!Object.keys(values).length) fail(400, '수정할 정보를 입력하세요.');
    await account.update(values);
    return { message: '회원 정보 수정 완료', user: await publicUser(account) };
}

module.exports = { edit };
