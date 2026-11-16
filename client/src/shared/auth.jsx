import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from './api';

const AuthContext = createContext(null);
const fieldsChangedKey = 'mathsite:member-fields-changed';
const sessionChangedKey = 'mathsite:session-changed';
export const useAuth = () => useContext(AuthContext);

// 다른 창에는 변경 신호만 보낸다. 설정과 회원 정보는 서버에서 다시 받는다.
function signalChange(key) {
    try {
        localStorage.setItem(key, String(Date.now()));
    } catch {
        // 저장소를 사용할 수 없는 창은 다시 활성화될 때 갱신한다.
    }
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [configuration, setConfiguration] = useState(null);
    const [checkingFields, setCheckingFields] = useState(true);
    const revision = useRef(0);
    const retryTimer = useRef(null);
    const { pathname } = useLocation();
    function updateUser(next) {
        setUser(next);
        signalChange(
            user?.id !== next?.id || user?.canManage !== next?.canManage
                ? sessionChangedKey
                : fieldsChangedKey,
        );
    }
    async function reloadAuth(savedConfiguration) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
        const request = ++revision.current;
        if (savedConfiguration) {
            setConfiguration(savedConfiguration);
            signalChange(fieldsChangedKey);
        }
        setCheckingFields(!savedConfiguration);
        try {
            const [auth, latestConfiguration] = await Promise.all([
                api('GET', '/auth/status'),
                savedConfiguration || api('GET', '/auth/fields'),
            ]);
            if (request !== revision.current) return;
            setUser(auth.user);
            setConfiguration(latestConfiguration);
            setError('');
        } catch (error) {
            if (request !== revision.current) return;
            setError(error.message);
            if (error.retryAfterMs) {
                setCheckingFields(true);
                retryTimer.current = setTimeout(
                    () => reloadAuth().catch(() => {}),
                    error.retryAfterMs,
                );
            } else if (!savedConfiguration) setConfiguration(null);
            throw error;
        } finally {
            if (request === revision.current && !retryTimer.current) setCheckingFields(false);
        }
    }
    useEffect(() => {
        let active = true;
        let refreshTimer;
        function refresh() {
            reloadAuth()
                .catch((error) => active && setError(error.message))
                .finally(() => active && setLoading(false));
        }
        function scheduleRefresh() {
            clearTimeout(refreshTimer);
            refreshTimer = setTimeout(refresh, 0);
        }
        function onVisibilityChange() {
            if (document.visibilityState === 'visible') scheduleRefresh();
        }
        function onStorage(event) {
            if (event.key === sessionChangedKey) {
                setUser(null);
                setLoading(true);
                scheduleRefresh();
            } else if (event.key === fieldsChangedKey) scheduleRefresh();
        }
        refresh();
        document.addEventListener('visibilitychange', onVisibilityChange);
        window.addEventListener('focus', scheduleRefresh);
        window.addEventListener('storage', onStorage);
        return () => {
            active = false;
            revision.current++;
            clearTimeout(retryTimer.current);
            clearTimeout(refreshTimer);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('focus', scheduleRefresh);
            window.removeEventListener('storage', onStorage);
        };
    }, [pathname]);
    return (
        <AuthContext.Provider
            value={{
                user,
                setUser: updateUser,
                loading,
                error,
                reloadAuth,
                fields: configuration?.fields,
                emailEnabled:
                    configuration?.fields.some((field) => field.key === 'email' && field.enabled) ??
                    false,
                fieldsReady: !checkingFields && Boolean(configuration),
                canRequestResetEmail:
                    !checkingFields && configuration?.canRequestResetEmail === true,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

// 화면 접근 검사. 실제 API 권한 검사는 Express에서도 매번 수행한다.
export function RequireUser({ admin = false, children }) {
    const { user, loading, error, fields } = useAuth();
    if (loading) return <p role="status">로그인 상태 확인 중…</p>;
    if (error && (!user || !fields)) return <p role="alert">{error}</p>;
    if (!user) return <Navigate to="/login" replace />;
    if (admin && !user.canManage) return <p role="alert">관리자만 접근할 수 있습니다.</p>;
    return children;
}
