const crypto = require('node:crypto');
const { Op } = require('sequelize');
const { sequelize, SignupCode, User, Role } = require('../../models');
const { fail } = require('../../shared/helpers');
const {
    listFields,
    requireEmailFields,
    validateFields,
} = require('../manager/member-fields.service');
const { publicUser, findUser } = require('./account');
const { hashPassword } = require('./password');
const { sendSignupCode, requireMail } = require('./mail');

const EXPIRES_SECONDS = 600;
const RESEND_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const invalidCode = '인증코드를 확인하거나 새 코드를 받아 주세요.';
const tooManyAttempts = '인증 시도 횟수를 초과했습니다. 새 코드를 받아 주세요.';

function digest(...parts) {
    return crypto
        .createHmac('sha256', process.env.SESSION_SECRET)
        .update(JSON.stringify(['email-signup', ...parts]))
        .digest('hex');
}

async function checkAvailability({ field, value }) {
    const configured = (await listFields()).find((item) => item.key === field && item.enabled);
    if (!configured) fail(404, '등록되지 않은 API입니다.');
    await validateFields({ [field]: value }, { fields: [configured] });
    return { available: true, message: `사용할 수 있는 ${configured.label}입니다.` };
}

async function signupFields(body, partial, transaction) {
    // 최종 저장은 회원 설정 행을 잠근 뒤 검사한다. 기존 중복 때문에 닉네임 인덱스를 보류한 DB도 보호한다.
    const fields = await requireEmailFields({
        transaction,
        lock: partial ? transaction.LOCK.SHARE : transaction.LOCK.UPDATE,
    });
    const values = await validateFields(body, { fields, transaction, partial });
    if (!values.email) fail(400, '이메일 형식을 확인하세요.');
    return { fields, values };
}

async function requestCode(req, body) {
    // 만료된 미가입 주소는 다음 발송 요청 때 정리한다.
    await SignupCode.destroy({ where: { expires_at: { [Op.lte]: new Date() } } });
    await sequelize.transaction(async (transaction) => {
        const { values } = await signupFields(body, true, transaction);
        requireMail('회원가입 인증');
        const code = String(crypto.randomInt(1_000_000)).padStart(6, '0');
        const now = Date.now();
        const challenge = {
            email: values.email,
            session_hash: digest(req.sessionID),
            code_hash: digest(req.sessionID, values.email, code),
            attempts: 0,
            expires_at: new Date(now + EXPIRES_SECONDS * 1000),
        };
        // 같은 주소의 첫 발송과 재발송을 한 행에 직렬화한다.
        await SignupCode.bulkCreate([challenge], { transaction, updateOnDuplicate: ['email'] });
        const [changed] = await SignupCode.update(
            { ...challenge, sent_at: new Date(now) },
            {
                where: {
                    email: values.email,
                    [Op.or]: [
                        { sent_at: null },
                        { sent_at: { [Op.lte]: new Date(now - RESEND_SECONDS * 1000) } },
                    ],
                },
                transaction,
            },
        );
        if (!changed) fail(429, '인증코드는 60초 후 다시 요청할 수 있습니다.');
        await sendSignupCode(values.email, code);
    });
    // 익명 브라우저에도 세션 쿠키가 발급되어 같은 브라우저에서만 확인할 수 있다.
    req.session.signupStarted = true;
    return {
        message: '이메일로 인증코드를 보냈습니다.',
        expiresIn: EXPIRES_SECONDS,
        resendAfter: RESEND_SECONDS,
    };
}

async function register(req, body) {
    const result = await sequelize.transaction(async (transaction) => {
        const { fields, values } = await signupFields(body, false, transaction);
        if (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) fail(400, invalidCode);
        const challenge = await SignupCode.findByPk(values.email, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        if (
            !challenge ||
            challenge.expires_at <= new Date() ||
            challenge.session_hash !== digest(req.sessionID)
        )
            fail(400, invalidCode);
        if (challenge.attempts >= MAX_ATTEMPTS) fail(429, tooManyAttempts);
        const actual = Buffer.from(digest(req.sessionID, values.email, body.code), 'hex');
        if (!crypto.timingSafeEqual(Buffer.from(challenge.code_hash, 'hex'), actual)) {
            const attempts = challenge.attempts + 1;
            await challenge.update({ attempts }, { transaction });
            // 실패 횟수가 커밋된 뒤 오류를 응답한다.
            return { rejected: attempts >= MAX_ATTEMPTS ? 429 : 400 };
        }
        const role = await Role.findOne({ where: { code: 'student' }, transaction });
        const account = await User.create(
            {
                ...values,
                password_hash: await hashPassword(body.password),
                role_id: role.id,
                status: 'pending',
            },
            { transaction },
        );
        await challenge.destroy({ transaction });
        return {
            message: '가입 신청 완료. 관리자가 승인한 뒤 로그인할 수 있습니다.',
            user: await publicUser(await findUser(account.id, { transaction }), fields),
        };
    });
    if (result.rejected)
        fail(result.rejected, result.rejected === 429 ? tooManyAttempts : invalidCode);
    return result;
}

module.exports = { checkAvailability, requestCode, register };
