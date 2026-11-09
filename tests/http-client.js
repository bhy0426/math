// 실제 HTTP 요청용 쿠키 보관함. OAuth 리다이렉트는 자동으로 따라가지 않는다.
function client(baseUrl) {
    let cookie = '';
    return async (method, url, body, extraHeaders = {}) => {
        const multipart = body instanceof FormData;
        const path =
            url === '/' || url === '/health' || url.startsWith('/auth/kakao') ? url : '/api' + url;
        const response = await fetch(baseUrl() + path, {
            method,
            redirect: 'manual',
            headers: {
                ...(cookie ? { Cookie: cookie } : {}),
                ...(!multipart && body !== undefined ? { 'Content-Type': 'application/json' } : {}),
                ...extraHeaders,
            },
            ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }),
            signal: AbortSignal.timeout(5000),
        });
        const cookies = response.headers.getSetCookie();
        if (cookies.length) cookie = cookies[cookies.length - 1].split(';')[0];
        const bytes = Buffer.from(await response.arrayBuffer());
        const json = response.headers.get('content-type')?.includes('application/json')
            ? JSON.parse(bytes.toString())
            : null;
        return { status: response.status, headers: response.headers, json, bytes };
    };
}

module.exports = { client };
