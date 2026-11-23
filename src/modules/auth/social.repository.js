const { Op } = require('sequelize');
const { SocialAccount, User } = require('../../models');
const { fail } = require('../../shared/helpers');

function createSocialRepository(provider) {
    const label = { kakao: '카카오', google: '구글' }[provider];
    if (!label) throw new Error('지원하지 않는 소셜 로그인입니다.');

    async function findAccount(appKeyHash, providerUserId) {
        const link = await SocialAccount.findOne({
            where: { provider, app_key_hash: appKeyHash, provider_user_id: providerUserId },
            include: { model: User, as: 'user' },
        });
        return link?.user;
    }

    async function hasConnection(appKeyHash, userId) {
        return hasAnyConnection(appKeyHash, [userId]);
    }

    async function hasAnyConnection(appKeyHash, userIds, options = {}) {
        return (
            (await SocialAccount.count({
                ...options,
                where: { provider, app_key_hash: appKeyHash, user_id: { [Op.in]: userIds } },
            })) > 0
        );
    }

    async function linkAccount(appKeyHash, providerUserId, userId) {
        const existing = await findAccount(appKeyHash, providerUserId);
        if (existing?.id === userId) return;
        if (existing) fail(409, `다른 회원에게 연결된 ${label} 계정입니다.`);
        await createLink(appKeyHash, providerUserId, userId);
    }

    function createLink(appKeyHash, providerUserId, userId, options) {
        return SocialAccount.create(
            {
                provider,
                app_key_hash: appKeyHash,
                provider_user_id: providerUserId,
                user_id: userId,
                user_scope: provider === 'google' ? '' : appKeyHash,
            },
            options,
        );
    }

    return { findAccount, hasConnection, hasAnyConnection, linkAccount, createLink };
}

module.exports = { createSocialRepository };
