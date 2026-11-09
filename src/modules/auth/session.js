const { query } = require('../../database');
const { fail, userSelect, publicUser } = require('../../shared/helpers');

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
async function loginSession(req, userId) {
    const [account] = await query(`${userSelect} WHERE u.id = ?`, [userId]);
    if (!account || account.status !== 'active')
        fail(403, '관리자 승인이 필요하거나 정지된 계정입니다.');
    await regenerateSession(req);
    req.session.userId = account.id;
    req.session.version = account.session_version;
    await saveSession(req);
    return publicUser(account);
}

module.exports = { loginSession, saveSession, regenerateSession };
