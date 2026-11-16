import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../shared/api';
import { useAction, useResource } from '../shared/hooks';
import { Field, Form, Page } from '../shared/components';
import MemberFields from '../shared/MemberFields';
import { useAuth } from '../shared/auth';

function EmailRegistration({ onRegistered }) {
    const { fieldsReady, canRequestResetEmail: mailReady } = useAuth();
    const [delivery, setDelivery] = useState(null);
    const action = useAction();

    async function sendCode(profile, element) {
        const result = await api('POST', '/auth/register/code', profile);
        setDelivery({ profile, expiresIn: result.expiresIn, resendAfter: result.resendAfter });
        if (element.elements.code) element.elements.code.value = '';
    }

    async function submit(form, element) {
        const { password, confirmPassword, code, ...profile } = Object.fromEntries(form);
        if (password !== confirmPassword) throw new Error('비밀번호가 일치하지 않습니다.');
        if (!delivery) return sendCode(profile, element);
        const result = await api('POST', '/auth/register', { ...profile, password, code });
        onRegistered(result.message);
    }

    return (
        <>
            <p role="status">{action.message}</p>
            {fieldsReady && !mailReady && (
                <p>현재 가입 인증 메일을 발송할 수 없습니다. 학원 관리자에게 문의하세요.</p>
            )}
            <Form
                busy={action.busy || !fieldsReady}
                onSubmit={(form, element) => action.run(() => submit(form, element))}
            >
                <div hidden={Boolean(delivery)}>
                    <MemberFields />
                    <Field
                        label="비밀번호 (8~128자)"
                        name="password"
                        type="password"
                        minLength={8}
                        maxLength={128}
                        autoComplete="new-password"
                        required
                    />
                    <Field
                        label="비밀번호 확인"
                        name="confirmPassword"
                        type="password"
                        minLength={8}
                        maxLength={128}
                        autoComplete="new-password"
                        required
                    />
                </div>
                {delivery ? (
                    <>
                        <p>
                            {delivery.profile.email}로 보낸 인증코드를 {delivery.expiresIn / 60}분
                            안에 입력하세요. 재발송은 발송 후 {delivery.resendAfter}초부터
                            가능합니다.
                        </p>
                        <Field
                            label="이메일 인증코드 (6자리)"
                            name="code"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            autoComplete="one-time-code"
                            required
                        />
                        <button>인증하고 가입 신청</button>
                        <button
                            type="button"
                            disabled={!mailReady}
                            onClick={(event) => {
                                const element = event.currentTarget.form;
                                action.run(() => sendCode(delivery.profile, element));
                            }}
                        >
                            인증코드 다시 받기
                        </button>
                        <button type="button" onClick={() => setDelivery(null)}>
                            가입 정보 수정
                        </button>
                    </>
                ) : (
                    <button disabled={!mailReady}>가입 인증코드 받기</button>
                )}
            </Form>
        </>
    );
}

function SocialRegistration({ onRegistered }) {
    const { fieldsReady } = useAuth();
    const kakao = useResource('/auth/kakao/status');
    const google = useResource('/auth/google/status');
    const providers = [
        { key: 'kakao', label: '카카오', status: kakao.data },
        { key: 'google', label: '구글', status: google.data },
    ].filter(({ status }) => status?.configured);
    const pending = providers.find(({ status }) => status.registrationRequired);
    const action = useAction();

    return (
        <>
            <p role="status">{action.message || kakao.error || google.error}</p>
            {pending ? (
                <Form
                    busy={action.busy || !fieldsReady}
                    onSubmit={(form) =>
                        action.run(async () => {
                            const result = await api(
                                'POST',
                                '/auth/' + pending.key + '/register',
                                Object.fromEntries(form),
                            );
                            onRegistered(result.message);
                        })
                    }
                >
                    <p>{pending.label} 계정 인증이 완료됐습니다. 가입 정보를 입력하세요.</p>
                    <MemberFields />
                    <button>가입 신청</button>
                    <a href={'/auth/' + pending.key}>다시 인증하기</a>
                </Form>
            ) : (
                <>
                    {providers.map(({ key, label }) => (
                        <p key={key}>
                            <a href={'/auth/' + key}>{label} 계정으로 가입</a>
                        </p>
                    ))}
                    {kakao.data && google.data && providers.length === 0 && (
                        <p>연결된 가입 수단이 없습니다. 학원 관리자에게 문의하세요.</p>
                    )}
                </>
            )}
        </>
    );
}

export default function RegisterPage() {
    const { fields, loading, user } = useAuth();
    const [confirmation, setConfirmation] = useState('');
    const emailEnabled = fields?.some((field) => field.key === 'email' && field.enabled);
    const fieldKey = fields?.map((field) => field.key).join('/');
    if (!loading && user) return <Navigate to="/user" replace />;
    return (
        <Page title="회원가입" message={confirmation}>
            {!confirmation && fields && (
                <>
                    <p>가입 신청이 완료되면 관리자가 승인한 뒤 로그인할 수 있습니다.</p>
                    {emailEnabled ? (
                        <EmailRegistration key={fieldKey} onRegistered={setConfirmation} />
                    ) : (
                        <SocialRegistration key={fieldKey} onRegistered={setConfirmation} />
                    )}
                </>
            )}
            <p>
                <Link to="/login">로그인으로</Link>
            </p>
        </Page>
    );
}
