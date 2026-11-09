const crypto = require('node:crypto');
const { kakaoConfig, requireKakaoConfig } = require('./kakao.config');
const kakaoClient = require('./kakao.client');
const accounts = require('./kakao.repository');
const { loginSession, saveSession, regenerateSession } = require('./session');
const { fail, text, email } = require('../../shared/helpers');
const LIFETIME = 10 * 60 * 1000;

function validPending(req, config) {
    const pending = req.session.kakaoRegistration;
    return pending && pending.expiresAt > Date.now() && pending.appKeyHash === config.appKeyHash
        ? pending
        : null;
}

async function status(req, res) {
    const config = kakaoConfig();
    res.json({
        configured: config.configured,
        registrationRequired: Boolean(config.configured && validPending(req, config)),
        linked: Boolean(
            config.configured &&
            req.user &&
            (await accounts.hasConnection(config.appKeyHash, req.user.id)),
        ),
    });
}

async function start(req, res) {
    const config = requireKakaoConfig();
    const linking = req.path === '/link';
    if (!linking && req.user) fail(409, '이미 로그인되어 있습니다. 계정 연결 버튼을 사용하세요.');
    // callback에 필요한 세션이 다른 호스트에서 만들어지지 않도록 정규 주소를 사용한다.
    const callback = new URL(config.redirectUri);
    if (req.get('host') !== callback.host || req.protocol !== callback.protocol.slice(0, -1)) {
        if (linking)
            fail(400, `${callback.origin}/에서 이메일로 다시 로그인한 뒤 카카오를 연결하세요.`);
        return res.redirect(303, `${callback.origin}/auth/kakao${linking ? '/link' : ''}`);
    }
    delete req.session.kakaoRegistration;
    req.session.kakaoFlow = {
        state: crypto.randomBytes(32).toString('hex'),
        expiresAt: Date.now() + LIFETIME,
        appKeyHash: config.appKeyHash,
        userId: linking ? req.user.id : null,
    };
    await saveSession(req);
    res.redirect(303, kakaoClient.authorizationUrl(config, req.session.kakaoFlow.state));
}

async function callback(req, res) {
    const config = requireKakaoConfig();
    const flow = req.session.kakaoFlow;
    const state = req.query.state;
    delete req.session.kakaoFlow;
    await saveSession(req);
    if (
        !flow ||
        flow.expiresAt <= Date.now() ||
        flow.appKeyHash !== config.appKeyHash ||
        typeof state !== 'string' ||
        !/^[a-f0-9]{64}$/.test(state) ||
        !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(flow.state))
    ) {
        fail(400, '카카오 로그인 요청이 만료되었거나 일치하지 않습니다. 로그인을 다시 시작하세요.');
    }
    if (req.query.error) return res.redirect(303, '/login?kakao=cancelled');
    const code = text(req.query.code, '카카오 인가 코드', 2048);
    if (flow.userId && req.user?.id !== flow.userId)
        fail(401, '연결을 시작한 계정으로 다시 로그인하세요.');
    const kakaoId = await kakaoClient.exchangeCode(config, code);
    if (flow.userId) {
        await accounts.linkAccount(config.appKeyHash, kakaoId, flow.userId);
        await loginSession(req, flow.userId);
        return res.redirect(303, '/user');
    }
    const account = await accounts.findAccount(config.appKeyHash, kakaoId);
    if (account) {
        if (account.status !== 'active') return res.redirect(303, '/login?kakao=approval');
        await loginSession(req, account.id);
        return res.redirect(303, '/courses');
    }
    await regenerateSession(req);
    req.session.kakaoRegistration = {
        appKeyHash: config.appKeyHash,
        kakaoId,
        expiresAt: Date.now() + LIFETIME,
    };
    await saveSession(req);
    res.redirect(303, '/login?kakao=register');
}

async function register(req, res) {
    const config = requireKakaoConfig();
    const identity = validPending(req, config);
    if (!identity || req.user) fail(400, '카카오 인증 후 10분 안에 가입 정보를 입력하세요.');
    const name = text(req.body.name, '이름', 80);
    const address = email(req.body.email);
    if (await accounts.findAccount(identity.appKeyHash, identity.kakaoId))
        fail(409, '이미 등록된 카카오 계정입니다.');
    const user = await accounts.registerAccount(identity, name, address);
    await regenerateSession(req);
    res.status(201).json({ message: '가입 완료. 관리자 승인 후 카카오로 로그인하세요.', user });
}

module.exports = { status, start, callback, register };
