const crypto = require('node:crypto');
const { fail } = require('../../shared/helpers');

function authorizationUrl(config, state, flow) {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: 'openid',
        state,
        code_challenge: crypto.createHash('sha256').update(flow.verifier).digest('base64url'),
        code_challenge_method: 'S256',
        prompt: 'select_account',
    });
    return url.toString();
}

async function googleRequest(url, options) {
    try {
        const response = await fetch(url, {
            ...options,
            redirect: 'error',
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error('인증 오류');
        return await response.json();
    } catch {
        fail(502, '구글 인증에 실패했습니다. 설정을 확인하고 다시 시작하세요.');
    }
}

async function exchangeCode(config, code, flow) {
    const token = await googleRequest('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: config.clientId,
            client_secret: config.clientSecret,
            redirect_uri: config.redirectUri,
            code,
            code_verifier: flow.verifier,
        }),
    });
    if (typeof token.access_token !== 'string' || !token.access_token)
        fail(502, '구글 인증 응답이 올바르지 않습니다.');
    const profile = await googleRequest('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (typeof profile.sub !== 'string' || !/^[a-zA-Z0-9_-]{1,255}$/.test(profile.sub))
        fail(502, '구글 계정 식별자를 확인할 수 없습니다.');
    return profile.sub;
}

module.exports = { authorizationUrl, googleRequest, exchangeCode };
