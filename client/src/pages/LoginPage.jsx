import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../shared/auth';
import { api } from '../shared/api';
import { useAction, useResource } from '../shared/hooks';
import { Field, Form, Page } from '../shared/components';

export default function LoginPage() {
    const { user, setUser, loading, fields, fieldsReady, canRequestResetEmail } = useAuth();
    const [params] = useSearchParams();
    const kakao = useResource('/auth/kakao/status');
    const google = useResource('/auth/google/status');
    const action = useAction();
    const providers = [
        { key: 'kakao', label: '카카오', state: kakao },
        { key: 'google', label: '구글', state: google },
    ].filter((provider) => provider.state.data?.configured);
    const result = params.get('kakao') || params.get('google');
    const messages = {
        approval: '관리자 승인이 필요하거나 정지된 계정입니다.',
        cancelled: '소셜 로그인을 취소했습니다.',
    };
    const identifiers = (fields || []).filter(
        (field) => field.enabled && ['username', 'email'].includes(field.key),
    );
    const singleIdentifier = identifiers.length === 1 ? identifiers[0].key : null;
    if (!loading && user) return <Navigate to="/courses" replace />;
    if (result === 'register') return <Navigate to="/register" replace />;
    return (
        <Page
            title="로그인"
            message={action.message || kakao.error || google.error || messages[result]}
        >
            {providers.map(({ key, label }) => (
                <p key={key}>
                    <a href={`/auth/${key}`}>{label} 로그인</a>
                </p>
            ))}
            {identifiers.length > 0 && (
                <Form
                    key={identifiers.map((field) => field.key).join('/')}
                    busy={action.busy || !fieldsReady}
                    onSubmit={(form) =>
                        action.run(async () => {
                            const response = await api(
                                'POST',
                                '/auth/login',
                                Object.fromEntries(form),
                            );
                            setUser(response.user);
                            return response;
                        })
                    }
                >
                    <Field
                        label={identifiers.map((field) => field.label).join(' 또는 ')}
                        name="identifier"
                        type={singleIdentifier === 'email' ? 'email' : 'text'}
                        pattern={
                            singleIdentifier === 'username'
                                ? '[A-Za-z][A-Za-z0-9_]{3,39}'
                                : undefined
                        }
                        maxLength={singleIdentifier === 'username' ? 40 : 254}
                        autoComplete="username"
                        required
                    />
                    <Field
                        label="비밀번호"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                    />
                    <button>로그인</button>
                </Form>
            )}
            <p>
                <Link to="/register">회원가입</Link>
                {(providers.length > 0 || canRequestResetEmail) && (
                    <>
                        {' '}
                        · <Link to="/reset">비밀번호 찾기</Link>
                    </>
                )}
            </p>
        </Page>
    );
}
