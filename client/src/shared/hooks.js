import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

// 목록·상세 조회와 새로고침. 이전 화면의 늦은 응답은 반영하지 않는다.
export function useResource(url, scope = '') {
    const [result, setResult] = useState({});
    const [revision, setRevision] = useState(0);
    const reload = useCallback(() => setRevision((value) => value + 1), []);
    useEffect(() => {
        if (!url) return;
        let active = true;
        let retryTimer;
        api('GET', url).then(
            (data) => active && setResult({ url, scope, data }),
            (error) => {
                if (!active) return;
                setResult((last) => ({
                    url,
                    scope,
                    error: error.message,
                    data:
                        error.retryAfterMs && last.url === url && last.scope === scope
                            ? last.data
                            : undefined,
                }));
                if (error.retryAfterMs) retryTimer = setTimeout(reload, error.retryAfterMs);
            },
        );
        return () => {
            active = false;
            clearTimeout(retryTimer);
        };
    }, [url, scope, revision, reload]);
    const current = result.url === url && result.scope === scope;
    return {
        data: current ? result.data : null,
        error: current ? result.error : '',
        reload,
    };
}

// 저장·삭제 요청의 처리 중 상태와 결과 문구를 공통으로 관리한다.
export function useAction() {
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    async function run(action, onSuccess) {
        setBusy(true);
        setMessage('');
        try {
            const result = await action();
            if (onSuccess) await onSuccess();
            setMessage(result?.message || '');
            return result;
        } catch (error) {
            setMessage(error.message);
        } finally {
            setBusy(false);
        }
    }
    return { message, busy, run };
}
