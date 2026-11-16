import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../shared/api';
import { useAction, useResource } from '../shared/hooks';
import { Field, Form, Page } from '../shared/components';
import { useAuth } from '../shared/auth';

export default function ResetPage() {
    const [params, setParams] = useSearchParams();
    const { fields, fieldsReady, canRequestResetEmail } = useAuth();
    const emailEnabled = fields?.some((field) => field.key === 'email' && field.enabled);
    const token = emailEnabled ? params.get('token') : null;
    const recovery = useResource('/auth/reset/status');
    const kakao = useResource('/auth/kakao/status');
    const google = useResource('/auth/google/status');
    const [done, setDone] = useState(false);
    const action = useAction();
    const result = params.get('kakao') || params.get('google');
    const messages = {
        cancelled: '본인 인증을 취소했습니다.',
        unlinked: '미리 연결된 활성 회원 계정을 찾을 수 없습니다. 관리자에게 문의하세요.',
    };
    return (
        <Page title="비밀번호 찾기" message={action.message || recovery.error || messages[result]}>
            {fieldsReady && !token && !recovery.data?.verified && !done && (
                <section>
                    {(kakao.data?.configured || google.data?.configured) && (
                        <p>
                            미리 연결한 소셜 계정으로 인증한 뒤 5분 안에 새 비밀번호를 설정하세요.
                        </p>
                    )}
                    {kakao.data?.configured && (
                        <p>
                            <a href="/auth/kakao/recover">카카오로 본인 인증</a>
                        </p>
                    )}
                    {google.data?.configured && (
                        <p>
                            <a href="/auth/google/recover">구글로 본인 인증</a>
                        </p>
                    )}
                    {canRequestResetEmail && (
                        <p>관리자에게 비밀번호 초기화 메일을 요청할 수 있습니다.</p>
                    )}
                </section>
            )}
            {(token || recovery.data?.verified) && !done && (
                <Form
                    hidden={Boolean(token) && !fieldsReady}
                    busy={action.busy || (Boolean(token) && !fieldsReady)}
                    onSubmit={(form) =>
                        action.run(async () => {
                            if (form.get('password') !== form.get('confirmPassword'))
                                throw new Error('비밀번호가 일치하지 않습니다.');
                            const response = await api('POST', '/auth/reset', {
                                ...(token ? { token } : {}),
                                password: form.get('password'),
                            });
                            setDone(true);
                            setParams({}, { replace: true });
                            return response;
                        })
                    }
                >
                    <Field
                        label="새 비밀번호"
                        name="password"
                        type="password"
                        minLength={8}
                        maxLength={128}
                        autoComplete="new-password"
                        required
                    />
                    <Field
                        label="새 비밀번호 확인"
                        name="confirmPassword"
                        type="password"
                        minLength={8}
                        maxLength={128}
                        autoComplete="new-password"
                        required
                    />
                    <button>새 비밀번호 설정</button>
                </Form>
            )}
            <Link to="/login">로그인으로</Link>
        </Page>
    );
}
