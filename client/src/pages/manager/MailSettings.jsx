import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { api } from '../../shared/api';
import { useAuth } from '../../shared/auth';
import { Field, Form } from '../../shared/components';
import { useAction, useResource } from '../../shared/hooks';

const connectionLabels = {
    unchecked: '아직 확인하지 않음',
    connected: '정상 · 메일 서버 인증 성공',
    auth_failed: '인증 거절 · 2단계 인증과 앱 비밀번호를 확인하고 다시 등록하세요.',
    unavailable: '연결 실패 · 잠시 후 다시 확인하세요.',
};

export default function MailSettings() {
    const settings = useResource('/manager/mail');
    const action = useAction();
    const { reloadAuth } = useAuth();
    const current = settings.data;
    const pending = current?.pending;
    const checkedOnEntry = useRef(false);
    const [checking, setChecking] = useState(false);
    const busy = checking || action.busy || !current;

    async function checkConnection() {
        setChecking(true);
        try {
            return await api('POST', '/manager/mail/check');
        } finally {
            settings.reload();
            reloadAuth().catch(() => {});
            setChecking(false);
        }
    }

    // 탭을 열면 등록된 발신 계정만 확인한다. 상태 새로고침은 재검사를 일으키지 않는다.
    const checkOnEntry = useEffectEvent(() => action.run(checkConnection));
    useEffect(() => {
        if (!current || checkedOnEntry.current) return;
        checkedOnEntry.current = true;
        if (current.sender) checkOnEntry();
    }, [current]);

    async function sendCode(form, element) {
        const result = await api('POST', '/manager/mail/verification', Object.fromEntries(form));
        element.reset();
        settings.reload();
        return result;
    }

    async function confirmSender(form) {
        try {
            const result = await api('POST', '/manager/mail/confirm', {
                verificationId: pending.verificationId,
                code: form.get('code'),
            });
            // 다음 회원 관리 작업에서도 새 발신자의 메일 사용 가능 여부를 반영한다.
            reloadAuth().catch(() => {});
            return result;
        } finally {
            settings.reload();
        }
    }

    return (
        <section>
            <h3>발신 메일 관리</h3>
            {!current && !settings.error && <p role="status">발신 계정을 불러오는 중…</p>}
            {current && !current.sender && !current.warning && !pending && (
                <p>
                    <strong>발신 계정 미등록.</strong> 예전에 메일을 보냈던 주소도 이 화면에서 한 번
                    등록해 주세요. 발신 주소와 앱 비밀번호를 입력하고, 그 주소로 받은 6자리 코드를
                    확인하면 가입 인증과 학생 안내 메일을 보낼 수 있습니다.
                </p>
            )}
            {current?.sender && (
                <>
                    <p>
                        등록된 발신 주소 <strong>{current.sender}</strong>
                    </p>
                    <p>메일함 인증 완료 · {new Date(current.verifiedAt).toLocaleString()}</p>
                    <p>이 서버에서는 이메일 사용을 껐다 켜도 등록한 발신 주소가 유지됩니다.</p>
                    <p role="status">
                        발송 연결 상태 ·{' '}
                        {checking ? '확인 중…' : connectionLabels[current.connectionStatus]}
                        {current.checkedAt &&
                            ' (최근 확인 ' + new Date(current.checkedAt).toLocaleString() + ')'}
                    </p>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => action.run(checkConnection)}
                    >
                        연결 다시 확인
                    </button>
                </>
            )}
            {current?.warning && <p role="alert">{current.warning}</p>}
            {current?.sender && <h4>발신 계정 변경</h4>}
            <p>이 주소에서 이미 발급받은 유효한 앱 비밀번호가 있으면 그대로 입력하세요.</p>
            <details>
                <summary>앱 비밀번호가 없거나 잃어버렸나요?</summary>
                <p>
                    Gmail은 발신에 쓸 Google 계정으로 로그인하세요.{' '}
                    <a
                        href="https://myaccount.google.com/signinoptions/two-step-verification"
                        target="_blank"
                        rel="noreferrer"
                    >
                        2단계 인증을 켜고
                    </a>{' '}
                    <a
                        href="https://myaccount.google.com/apppasswords"
                        target="_blank"
                        rel="noreferrer"
                    >
                        앱 비밀번호 페이지
                    </a>
                    에서 이름을 MathSite로 입력해 발급받은 16자리를 사용하세요. 기존 값을
                    잃어버렸다면 같은 계정에서 새로 발급하세요.
                </p>
                <p>
                    네이버는 계정에서 2단계 인증과 애플리케이션 비밀번호를 설정하고, 메일
                    환경설정에서 IMAP/SMTP 사용을 켜세요.{' '}
                    <a
                        href="https://help.naver.com/service/30029/contents/21344"
                        target="_blank"
                        rel="noreferrer"
                    >
                        네이버 설정 안내
                    </a>
                </p>
            </details>
            <p role="status">{action.message || settings.error}</p>
            <Form
                busy={busy}
                onSubmit={(form, element) => action.run(() => sendCode(form, element))}
            >
                <Field
                    label="새 발신 주소 (Gmail 또는 네이버)"
                    name="email"
                    type="email"
                    required
                />
                <Field
                    label="메일 서비스에서 발급한 앱 비밀번호"
                    name="appPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                />
                <button>새 주소로 인증코드 보내기</button>
            </Form>
            {pending && (
                <Form
                    key={pending.verificationId}
                    busy={busy}
                    onSubmit={(form) => action.run(() => confirmSender(form))}
                >
                    <p>
                        <strong>{pending.email}</strong> 받은편지함에 도착한 6자리 코드를 아래에
                        입력하세요. 입력 기한은 {new Date(pending.expiresAt).toLocaleTimeString()}
                        까지입니다.
                    </p>
                    <Field
                        label="발신 주소 인증코드"
                        name="code"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        autoComplete="one-time-code"
                        required
                    />
                    <button>확인하고 발신 주소 적용</button>
                </Form>
            )}
        </section>
    );
}
