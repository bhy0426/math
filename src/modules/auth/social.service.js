const crypto = require('node:crypto');
const { fail, text } = require('../../shared/helpers');
const { sequelize, Role, User } = require('../../models');
const { hashPassword } = require('./password');
const { findUser, publicUser } = require('./account');
const { saveSession, regenerateSession, loginSession } = require('./session');
const { listFields, validateFields } = require('../manager/member-fields.service');

function usesEmailSignup(fields) {
    return fields.some((field) => field.key === 'email' && field.enabled);
}

// 공급자별 설정·통신·저장소를 받아 공통 인증 흐름을 만든다.
function createSocialService(name, getConfig, client, accounts) {
    const flowKey = `${name}Flow`;
    const registrationKey = `${name}Registration`;
    function validPending(req, config) {
        const pending = req.session[registrationKey];
        return pending && pending.expiresAt > Date.now() && pending.appKeyHash === config.appKeyHash
            ? pending
            : null;
    }
    function configRequired() {
        const config = getConfig();
        if (!config.configured)
            fail(503, `${name} 로그인 설정이 필요합니다. docs/social-login.md를 확인하세요.`);
        return config;
    }
    async function status(req) {
        const config = getConfig();
        return {
            configured: config.configured,
            registrationRequired: Boolean(
                config.configured &&
                validPending(req, config) &&
                !usesEmailSignup(await listFields()),
            ),
            linked: Boolean(
                config.configured &&
                req.user &&
                (await accounts.hasConnection(config.appKeyHash, req.user.id)),
            ),
        };
    }
    async function start(req) {
        const config = configRequired();
        const mode = req.path === '/link' ? 'link' : req.path === '/recover' ? 'recover' : 'login';
        if (mode === 'login' && req.user)
            fail(409, '이미 로그인되어 있습니다. 계정 연결 버튼을 사용하세요.');
        const callback = new URL(config.redirectUri);
        if (req.get('host') !== callback.host || req.protocol !== callback.protocol.slice(0, -1)) {
            if (mode === 'link') fail(400, `${callback.origin}/에서 다시 로그인한 뒤 연결하세요.`);
            return `${callback.origin}/auth/${name}${mode === 'recover' ? '/recover' : ''}`;
        }
        delete req.session[registrationKey];
        delete req.session.passwordRecovery;
        const flow = {
            state: crypto.randomBytes(32).toString('hex'),
            verifier: crypto.randomBytes(32).toString('base64url'),
            expiresAt: Date.now() + 10 * 60 * 1000,
            appKeyHash: config.appKeyHash,
            mode,
            userId: mode === 'link' ? req.user.id : null,
        };
        req.session[flowKey] = flow;
        await saveSession(req);
        return client.authorizationUrl(config, flow.state, flow);
    }
    async function callback(req) {
        const config = configRequired();
        const flow = req.session[flowKey];
        const state = req.query.state;
        delete req.session[flowKey];
        await saveSession(req);
        if (
            !flow ||
            flow.expiresAt <= Date.now() ||
            flow.appKeyHash !== config.appKeyHash ||
            typeof state !== 'string' ||
            !/^[a-f0-9]{64}$/.test(state) ||
            !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(flow.state))
        )
            fail(400, '소셜 인증 요청이 만료되었거나 일치하지 않습니다. 다시 시작하세요.');
        const returnPage = flow.mode === 'recover' ? '/reset' : '/login';
        if (req.query.error) return `${returnPage}?${name}=cancelled`;
        if (flow.userId && req.user?.id !== flow.userId)
            fail(401, '연결을 시작한 계정으로 다시 로그인하세요.');
        const identity = await client.exchangeCode(
            config,
            text(req.query.code, '인가 코드', 2048),
            flow,
        );
        if (flow.mode === 'link') {
            await accounts.linkAccount(config.appKeyHash, identity, flow.userId);
            await loginSession(req, flow.userId);
            return '/user';
        }
        const account = await accounts.findAccount(config.appKeyHash, identity);
        if (flow.mode === 'recover') {
            if (!account || account.status !== 'active') return `/reset?${name}=unlinked`;
            await regenerateSession(req);
            req.session.passwordRecovery = {
                userId: account.id,
                version: account.session_version,
                expiresAt: Date.now() + 5 * 60 * 1000,
            };
            await saveSession(req);
            return `/reset?verified=${name}`;
        }
        if (account) {
            if (account.status !== 'active') return `/login?${name}=approval`;
            await loginSession(req, account.id);
            return '/courses';
        }
        await regenerateSession(req);
        if (usesEmailSignup(await listFields())) return '/register';
        req.session[registrationKey] = {
            appKeyHash: config.appKeyHash,
            identity,
            expiresAt: Date.now() + 10 * 60 * 1000,
        };
        await saveSession(req);
        return `/register?${name}=register`;
    }
    async function register(req, body) {
        const accountId = await sequelize.transaction(async (transaction) => {
            const fields = await listFields({ transaction, lock: transaction.LOCK.UPDATE });
            if (usesEmailSignup(fields)) fail(404, '등록되지 않은 API입니다.');
            const pending = validPending(req, configRequired());
            if (!pending || req.user) fail(400, '소셜 인증 후 10분 안에 가입 정보를 입력하세요.');
            const values = await validateFields(body, { fields, transaction });
            const role = await Role.findOne({ where: { code: 'student' }, transaction });
            const account = await User.create(
                {
                    ...values,
                    password_hash: await hashPassword(crypto.randomBytes(48).toString('hex')),
                    role_id: role.id,
                    status: 'pending',
                },
                { transaction },
            );
            await accounts.createLink(pending.appKeyHash, pending.identity, account.id, {
                transaction,
            });
            return account.id;
        });
        await regenerateSession(req);
        return {
            message: '가입 완료. 관리자 승인 후 로그인하세요.',
            user: await publicUser(await findUser(accountId)),
        };
    }
    return { validPending, status, start, callback, register };
}

module.exports = { createSocialService };
