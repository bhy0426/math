const crypto = require('node:crypto');
const { fail } = require('../../shared/helpers');

// 키는 서버의 .env에서만 읽는다. 브라우저에는 설정 여부만 알려준다.
function kakaoConfig() {
    const clientId = process.env.KAKAO_REST_API_KEY?.trim();
    const clientSecret = process.env.KAKAO_CLIENT_SECRET?.trim();
    const redirectUri = process.env.KAKAO_REDIRECT_URI?.trim();
    let callback;
    try {
        callback = new URL(redirectUri);
    } catch {
        /* 미설정 상태 */
    }
    const configured = Boolean(
        clientId &&
        clientSecret &&
        callback &&
        ['http:', 'https:'].includes(callback.protocol) &&
        !callback.username &&
        !callback.password &&
        callback.pathname === '/auth/kakao/callback' &&
        !callback.search &&
        !callback.hash,
    );
    return {
        clientId,
        clientSecret,
        redirectUri,
        configured,
        appKeyHash: clientId ? crypto.createHash('sha256').update(clientId).digest('hex') : null,
    };
}

function requireKakaoConfig() {
    const config = kakaoConfig();
    if (!config.configured)
        fail(503, '카카오 개발자 앱 설정이 필요합니다. docs/kakao-setup.md를 확인하세요.');
    return config;
}

module.exports = { kakaoConfig, requireKakaoConfig };
