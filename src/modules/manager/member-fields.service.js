const { MemberField, User } = require('../../models');
const { fail, text, email, username } = require('../../shared/helpers');
const { canSendResetEmail } = require('../auth/mail');

const definitions = [
    { key: 'username', label: '아이디', validate: username },
    { key: 'nickname', label: '닉네임', validate: (value) => text(value, '닉네임', 80) },
    { key: 'email', label: '이메일', validate: email },
];

async function listFields(options = {}) {
    const saved = await MemberField.findAll(options);
    return definitions.map(({ key, label }) => ({
        key,
        label,
        enabled: saved.find((row) => row.key === key)?.enabled ?? true,
    }));
}

function canRequestResetEmail(fields) {
    return fields.some((field) => field.key === 'email' && field.enabled) && canSendResetEmail();
}

async function publicConfiguration() {
    const fields = (await listFields()).filter((field) => field.enabled);
    return { fields, canRequestResetEmail: canRequestResetEmail(fields) };
}

async function editFields(body) {
    if (!Array.isArray(body.fields) || body.fields.length !== definitions.length)
        fail(400, '아이디·닉네임·이메일 설정을 모두 보내세요.');
    const keys = new Set();
    for (const field of body.fields) {
        if (
            !field ||
            typeof field !== 'object' ||
            !definitions.some((row) => row.key === field.key) ||
            keys.has(field.key) ||
            typeof field.enabled !== 'boolean'
        )
            fail(400, '올바르지 않은 회원 항목 설정입니다.');
        keys.add(field.key);
    }
    if (!body.fields.some((field) => ['username', 'email'].includes(field.key) && field.enabled))
        fail(400, '비밀번호 로그인에 사용할 아이디 또는 이메일 하나는 켜 두세요.');
    const fields = definitions.map(({ key, label }) => ({
        key,
        label,
        enabled: body.fields.find((field) => field.key === key).enabled,
    }));
    // 한 번의 저장으로 세 스위치를 함께 반영한다. 회원 데이터는 건드리지 않는다.
    await MemberField.bulkCreate(fields, {
        fields: ['key', 'enabled'],
        updateOnDuplicate: ['enabled'],
    });
    return {
        message: '회원 항목 설정 저장 완료',
        fields,
        canRequestResetEmail: canRequestResetEmail(fields),
    };
}

async function validateFields(body, { partial = false, currentUser, fields, transaction } = {}) {
    fields ??= await listFields({ transaction });
    const values = {};
    for (const field of fields) {
        if (!field.enabled) {
            if (body[field.key] !== undefined) fail(400, '입력 항목을 확인하고 다시 제출하세요.');
            continue;
        }
        if (partial && body[field.key] === undefined) continue;
        values[field.key] = definitions
            .find((row) => row.key === field.key)
            .validate(body[field.key]);
    }
    if (
        values.nickname !== undefined &&
        values.nickname !== currentUser?.nickname &&
        (await User.count({ where: { nickname: values.nickname }, transaction }))
    )
        fail(409, '이미 사용 중인 닉네임입니다.');
    return values;
}

function selectFields(value, fields) {
    return Object.fromEntries(
        fields.filter((field) => field.enabled).map(({ key }) => [key, value[key] ?? null]),
    );
}

module.exports = { listFields, publicConfiguration, editFields, validateFields, selectFields };
