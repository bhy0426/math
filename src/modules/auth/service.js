const crypto = require('node:crypto');
const { Op } = require('sequelize');
const { sequelize, User, PasswordReset } = require('../../models');
const { fail, text, id } = require('../../shared/helpers');
const { findUser, publicUser } = require('./account');
const { hashPassword, verifyPassword, needsRehash } = require('./password');
const { loginSession, regenerateSession } = require('./session');
const { requireMail, sendReset } = require('./mail');
const { listFields, requireEmailFields } = require('../manager/member-fields.service');

function status(user) {
    return { loggedIn: Boolean(user), user: user || null };
}

async function login(req, body) {
    const fields = await listFields();
    const enabled = (key) => fields.some((field) => field.key === key && field.enabled);
    const supplied = body.identifier ?? (enabled('email') ? body.email : undefined);
    const identifier = typeof supplied === 'string' ? supplied.trim().toLowerCase() : '';
    const key = identifier.includes('@') ? 'email' : 'username';
    const invalidLogin = '로그인 정보가 일치하지 않습니다.';
    if (!identifier || identifier.length > 254 || !enabled(key)) fail(401, invalidLogin);
    const account = await User.findOne({
        where: { [key]: identifier },
    });
    if (!account || !(await verifyPassword(body.password, account.password_hash)))
        fail(401, invalidLogin);
    if (account.status !== 'active') fail(403, '관리자 승인이 필요하거나 정지된 계정입니다.');
    if (needsRehash(account.password_hash)) {
        const [changed] = await User.update(
            { password_hash: await hashPassword(body.password, { legacyUpgrade: true }) },
            {
                where: {
                    id: account.id,
                    password_hash: account.password_hash,
                    session_version: account.session_version,
                },
            },
        );
        if (!changed) fail(401, '계정 정보가 변경되었습니다. 다시 로그인하세요.');
    }
    return {
        message: '로그인 완료',
        user: await loginSession(req, account.id, account.session_version),
    };
}

async function logout(req) {
    await new Promise((resolve, reject) =>
        req.session.destroy((error) => (error ? reject(error) : resolve())),
    );
    return { message: '로그아웃 완료' };
}

async function requestAdminReset(userId) {
    await requireEmailFields();
    requireMail();
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const lockedPassword = await hashPassword(crypto.randomBytes(48).toString('hex'));
    await sequelize.transaction(async (transaction) => {
        const account = await User.findByPk(id(userId), {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        if (!account) fail(404, '회원이 없습니다.');
        if (!account.email) fail(409, '회원 이메일을 먼저 등록하세요.');
        await PasswordReset.destroy({ where: { user_id: account.id }, transaction });
        await PasswordReset.create(
            {
                token_hash: tokenHash,
                user_id: account.id,
                expires_at: new Date(Date.now() + 30 * 60 * 1000),
            },
            { transaction },
        );
        await account.update(
            { password_hash: lockedPassword, session_version: account.session_version + 1 },
            { transaction },
        );
        // 메일 실패 시 트랜잭션을 되돌려 기존 비밀번호·세션을 보존한다.
        await sendReset(account.email, token);
    });
    return { message: '기존 비밀번호와 로그인을 초기화하고 재설정 메일을 발송했습니다.' };
}

async function recoveryStatus(req) {
    const recovery = req.session.passwordRecovery;
    const account =
        recovery && recovery.expiresAt > Date.now() ? await User.findByPk(recovery.userId) : null;
    return {
        verified: Boolean(
            account && account.status === 'active' && account.session_version === recovery.version,
        ),
    };
}

async function reset(body, req) {
    if (!body.token) {
        const recovery = req.session.passwordRecovery;
        if (!(await recoveryStatus(req)).verified) fail(400, '카카오·구글 본인 인증이 필요합니다.');
        const passwordHash = await hashPassword(body.password);
        await sequelize.transaction(async (transaction) => {
            const account = await User.findByPk(recovery.userId, {
                transaction,
                lock: transaction.LOCK.UPDATE,
            });
            if (
                !account ||
                account.status !== 'active' ||
                account.session_version !== recovery.version ||
                recovery.expiresAt <= Date.now()
            )
                fail(400, '본인 인증이 만료되었습니다. 다시 인증하세요.');
            await account.update(
                { password_hash: passwordHash, session_version: account.session_version + 1 },
                { transaction },
            );
            await PasswordReset.destroy({ where: { user_id: account.id }, transaction });
        });
        await regenerateSession(req);
        return { message: '비밀번호 변경 완료. 다시 로그인하세요.' };
    }
    await requireEmailFields();
    const token = text(body.token, '메일의 재설정 토큰', 128);
    const passwordHash = await hashPassword(body.password);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const pending = await PasswordReset.findByPk(tokenHash);
    if (!pending) fail(400, '유효하지 않거나 만료된 인증 토큰입니다.');
    await sequelize.transaction(async (transaction) => {
        const account = await User.findByPk(pending.user_id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        const reset = await PasswordReset.findOne({
            where: { token_hash: tokenHash, used_at: null, expires_at: { [Op.gt]: new Date() } },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        if (!account || !reset) fail(400, '유효하지 않거나 만료된 인증 토큰입니다.');
        await account.update(
            { password_hash: passwordHash, session_version: account.session_version + 1 },
            { transaction },
        );
        await reset.update({ used_at: new Date() }, { transaction });
    });
    if (req) await regenerateSession(req);
    return { message: '비밀번호 변경 완료. 다시 로그인하세요.' };
}

async function currentAccount(req) {
    if (!req.session.userId) return null;
    const user = await findUser(req.session.userId);
    return user && user.status === 'active' && user.session_version === req.session.version
        ? publicUser(user)
        : null;
}

module.exports = {
    status,
    login,
    logout,
    requestAdminReset,
    recoveryStatus,
    reset,
    currentAccount,
};
