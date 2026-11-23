const { sequelize, MemberField, User, Role } = require('../../models');
const { fail } = require('../../shared/helpers');
const { listFields, validateFieldSettings } = require('../user/member-fields.service');
const { kakaoConfig } = require('../auth/kakao.config');
const { googleConfig } = require('../auth/google.config');
const { createSocialRepository } = require('../auth/social.repository');
const { canSendResetEmail } = require('../mail/transport');
const { cancelVerification } = require('../mail/sender.service');

// 한 로그인 항목을 끌 때, 실제 활성 관리자가 남은 항목이나 연결된 소셜 계정으로 돌아올 수 있어야 한다.
async function checkManagerLogin(remainingKey, transaction) {
    const admins = await User.findAll({
        where: { status: 'active' },
        attributes: ['id', remainingKey],
        include: { model: Role, as: 'roleRecord', where: { can_manage: true }, attributes: [] },
        transaction,
        lock: transaction.LOCK.UPDATE,
    });
    if (admins.some((admin) => admin[remainingKey])) return;
    const userIds = admins.map((admin) => admin.id);
    for (const [provider, config] of [
        ['kakao', kakaoConfig()],
        ['google', googleConfig()],
    ]) {
        if (
            config.configured &&
            (await createSocialRepository(provider).hasAnyConnection(config.appKeyHash, userIds, {
                transaction,
            }))
        )
            return;
    }
    const label = remainingKey === 'username' ? '아이디' : '이메일';
    fail(409, `활성 관리자에게 ${label} 값을 등록하거나 소셜 계정을 연결한 뒤 설정을 저장하세요.`);
}

async function editFields(body) {
    const fields = validateFieldSettings(body);
    // 한 번의 저장으로 세 스위치를 함께 반영한다. 회원 데이터는 건드리지 않는다.
    await sequelize.transaction(async (transaction) => {
        const current = await listFields({ transaction, lock: transaction.LOCK.UPDATE });
        const loginOptions = fields.filter((field) => field.enabled && field.key !== 'nickname');
        if (
            loginOptions.length === 1 &&
            current.some(
                (field) =>
                    field.enabled && field.key !== 'nickname' && field.key !== loginOptions[0].key,
            )
        )
            await checkManagerLogin(loginOptions[0].key, transaction);
        await MemberField.bulkCreate(fields, {
            fields: ['key', 'enabled'],
            updateOnDuplicate: ['enabled'],
            transaction,
        });
    });
    if (!fields.find((field) => field.key === 'email').enabled) cancelVerification();
    return {
        message: '회원 항목 설정 저장 완료',
        fields,
        canRequestResetEmail:
            fields.some((field) => field.key === 'email' && field.enabled) && canSendResetEmail(),
    };
}

module.exports = { editFields };
