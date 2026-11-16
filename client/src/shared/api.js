// 화면은 이 함수로만 기존 Express API를 호출한다.
export async function api(method, path, body) {
    const multipart = body instanceof FormData;
    const response = await fetch('/api' + path, {
        method,
        credentials: 'same-origin',
        headers: body !== undefined && !multipart ? { 'Content-Type': 'application/json' } : {},
        ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }),
    });
    const data = await response.json();
    if (!response.ok) {
        const error = new Error(data.message || '요청에 실패했습니다.');
        if (method === 'GET' && response.status === 503) {
            const seconds = Number(response.headers?.get('Retry-After'));
            if (Number.isInteger(seconds) && seconds > 0) error.retryAfterMs = seconds * 1000;
        }
        throw error;
    }
    return data;
}
