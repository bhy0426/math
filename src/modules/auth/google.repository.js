const { GoogleAccount, User } = require('../../models');
const { fail } = require('../../shared/helpers');

async function findAccount(clientIdHash, googleId) {
    const link = await GoogleAccount.findOne({
        where: { client_id_hash: clientIdHash, google_id: googleId },
        include: { model: User, as: 'user' },
    });
    return link?.user;
}
async function hasConnection(clientIdHash, userId) {
    return (
        (await GoogleAccount.count({ where: { client_id_hash: clientIdHash, user_id: userId } })) >
        0
    );
}
async function linkAccount(clientIdHash, googleId, userId) {
    const account = await findAccount(clientIdHash, googleId);
    if (account?.id === userId) return;
    if (account) fail(409, '다른 회원에게 연결된 구글 계정입니다.');
    await createLink(clientIdHash, googleId, userId);
}
function createLink(clientIdHash, googleId, userId, options) {
    return GoogleAccount.create(
        { client_id_hash: clientIdHash, google_id: googleId, user_id: userId },
        options,
    );
}

module.exports = { findAccount, hasConnection, linkAccount, createLink };
