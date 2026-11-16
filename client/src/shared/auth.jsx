import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from './api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [configuration, setConfiguration] = useState(null);
    const [checkingFields, setCheckingFields] = useState(true);
    const revision = useRef(0);
    const retryTimer = useRef(null);
    const { pathname } = useLocation();
    async function reloadAuth(savedConfiguration) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
        const request = ++revision.current;
        if (savedConfiguration) setConfiguration(savedConfiguration);
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
        function refresh() {
            reloadAuth()
                .catch((error) => active && setError(error.message))
                .finally(() => active && setLoading(false));
        }
        function onVisibilityChange() {
            if (document.visibilityState === 'visible') refresh();
        }
        refresh();
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            active = false;
            revision.current++;
            clearTimeout(retryTimer.current);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [pathname]);
    return (
        <AuthContext.Provider
            value={{
                user,
                setUser,
                loading,
                error,
                reloadAuth,
                fields: configuration?.fields,
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
