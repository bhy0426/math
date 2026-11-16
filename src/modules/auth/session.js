const { fail } = require('../../shared/helpers');
const { findUser, publicUser } = require('./account');

function saveSession(req) {
    return new Promise((resolve, reject) =>
        req.session.save((error) => (error ? reject(error) : resolve())),
    );
}

function regenerateSession(req) {
    return new Promise((resolve, reject) =>
        req.session.regenerate((error) => (error ? reject(error) : resolve())),
    );
}

// 이메일과 카카오는 동일한 DB 역할·정지 상태·세션 정책을 사용한다.
async function loginSession(req, userId, expectedVersion) {
    const account = await findUser(userId);
    if (!account || account.status !== 'active')
        fail(403, '관리자 승인이 필요하거나 정지된 계정입니다.');
    if (expectedVersion !== undefined && account.session_version !== expectedVersion)
        fail(401, '계정 정보가 변경되었습니다. 다시 로그인하세요.');
    await regenerateSession(req);
    req.session.userId = account.id;
    req.session.version = account.session_version;
    await saveSession(req);
    return publicUser(account);
}

module.exports = { loginSession, saveSession, regenerateSession };
