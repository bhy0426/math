const { MemberField, User } = require('../../models');
const { Op, Validator } = require('sequelize');
const { fail, text, email, username } = require('../../shared/helpers');

const definitions = [
    { key: 'username', label: '아이디', validate: username },
    { key: 'nickname', label: '닉네임', validate: (value) => text(value, '닉네임', 80) },
    { key: 'email', label: '이메일', validate: memberEmail },
];

function memberEmail(value) {
    const address = email(value);
    if (!Validator.isEmail(address)) fail(400, '이메일 형식을 확인하세요.');
    return address;
}

async function listFields(options = {}) {
    const saved = await MemberField.findAll(options);
    return definitions.map(({ key, label }) => ({
        key,
        label,
        enabled: saved.find((row) => row.key === key)?.enabled ?? true,
    }));
}

async function requireEmailFields(options = {}) {
    const fields = await listFields(options);
    if (!fields.some((field) => field.key === 'email' && field.enabled))
        fail(404, '등록되지 않은 API입니다.');
    return fields;
}

async function ensureFieldDefaults() {
    // 저장된 스위치는 유지하고 새 DB에만 기본 행을 채워 가입·회원 수정이 같은 행을 잠글 수 있게 한다.
    await MemberField.bulkCreate(
        definitions.map(({ key }) => ({ key, enabled: true })),
        {
            ignoreDuplicates: true,
        },
    );
}

function validateFieldSettings(body) {
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
    return fields;
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
        const key = field.key;
        const value = definitions.find((row) => row.key === key).validate(body[key]);
        if (value !== currentUser?.[key]) {
            const where = { [key]: value };
            if (currentUser) where.id = { [Op.ne]: currentUser.id };
            if (await User.count({ where, transaction }))
                fail(409, `이미 사용 중인 ${field.label}입니다.`);
        }
        values[key] = value;
    }
    return values;
}

function selectFields(value, fields) {
    return Object.fromEntries(
        fields.filter((field) => field.enabled).map(({ key }) => [key, value[key] ?? null]),
    );
}

module.exports = {
    ensureFieldDefaults,
    listFields,
    requireEmailFields,
    validateFieldSettings,
    validateFields,
    selectFields,
};
