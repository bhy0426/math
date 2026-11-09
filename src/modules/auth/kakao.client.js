const { fail } = require('../../shared/helpers');

function authorizationUrl(config, state) {
    const url = new URL('https://kauth.kakao.com/oauth/authorize');
    url.search = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        state,
    });
    return url.toString();
}

async function kakaoRequest(url, options) {
    try {
        const response = await fetch(url, {
            ...options,
            redirect: 'error',
            signal: AbortSignal.timeout(10000),
        });
        // 회원번호는 Long이므로 큰 정수도 반올림 없이 문자열로 보존한다.
        const data = JSON.parse(await response.text(), (key, value, context) => {
            if (key === 'id' && typeof value === 'number') {
                if (context?.source) return context.source;
                if (!Number.isSafeInteger(value)) throw new Error('회원번호 정밀도 오류');
                return String(value);
            }
            return value;
        });
        if (!response.ok) throw new Error('카카오 API 오류');
        return data;
    } catch {
        // 공급자의 응답에는 토큰이 있을 수 있으므로 원문을 반환하거나 기록하지 않는다.
        fail(502, '카카오 인증에 실패했습니다. 설정을 확인하고 로그인을 다시 시작하세요.');
    }
}

async function exchangeCode(config, code) {
    const token = await kakaoRequest('https://kauth.kakao.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: config.clientId,
            client_secret: config.clientSecret,
            redirect_uri: config.redirectUri,
            code,
        }),
    });
    if (typeof token.access_token !== 'string' || !token.access_token)
        fail(502, '카카오 인증 응답이 올바르지 않습니다.');
    const account = await kakaoRequest('https://kapi.kakao.com/v2/user/me', {
        headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (
        typeof account.id !== 'string' ||
        !/^[1-9]\d{0,18}$/.test(account.id) ||
        BigInt(account.id) > 9223372036854775807n
    ) {
        fail(502, '카카오 회원번호를 확인할 수 없습니다.');
    }
    return account.id;
}

module.exports = { authorizationUrl, exchangeCode };
