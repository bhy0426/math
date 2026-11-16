const { KakaoAccount, User } = require('../../models');
const { fail } = require('../../shared/helpers');

async function findAccount(appKeyHash, kakaoId) {
    const link = await KakaoAccount.findOne({
        where: { app_key_hash: appKeyHash, kakao_id: kakaoId },
        include: { model: User, as: 'user' },
    });
    return link?.user;
}
async function hasConnection(appKeyHash, userId) {
    return (await KakaoAccount.count({ where: { app_key_hash: appKeyHash, user_id: userId } })) > 0;
}
async function linkAccount(appKeyHash, kakaoId, userId) {
    const existing = await findAccount(appKeyHash, kakaoId);
    if (existing?.id === userId) return;
    if (existing) fail(409, '다른 회원에게 연결된 카카오 계정입니다.');
    await createLink(appKeyHash, kakaoId, userId);
}
function createLink(appKeyHash, kakaoId, userId, options) {
    return KakaoAccount.create(
        { app_key_hash: appKeyHash, kakao_id: kakaoId, user_id: userId },
        options,
    );
}

module.exports = { findAccount, hasConnection, linkAccount, createLink };
