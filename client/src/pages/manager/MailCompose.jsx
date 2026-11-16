import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api';
import { useAuth } from '../../shared/auth';
import { Field } from '../../shared/components';
import { useResource } from '../../shared/hooks';
import { memberLabel } from '../../shared/memberLabel.mjs';
import StudentChecklist from './StudentChecklist';

const results = {
    sent: '메일 서버 접수',
    failed: '발송 실패',
    unknown: '접수 여부 미확인',
    pending: '발송 중',
};

// 이 탭이 보낸 요청 번호만 보관해 새로고침해도 같은 발송의 결과를 조회한다.
function remember(key, value) {
    try {
        if (value === undefined) return sessionStorage.getItem(key);
        if (value) sessionStorage.setItem(key, value);
        else sessionStorage.removeItem(key);
    } catch {
        /* 저장을 차단한 브라우저에서는 현재 화면에서만 결과를 확인한다. */
    }
}

export default function MailCompose() {
    const { user } = useAuth();
    const storageKey = 'mathsite:broadcast:' + user.id;
    const [requestId, setRequestId] = useState(() => remember(storageKey));
    function showReceipt(id) {
        remember(storageKey, id);
        setRequestId(id);
    }
    return requestId ? (
        <BroadcastReceipt id={requestId} onNew={() => showReceipt(null)} />
    ) : (
        <BroadcastForm onSubmitted={showReceipt} storageKey={storageKey} />
    );
}

function BroadcastForm({ onSubmitted, storageKey }) {
    const { fields, fieldsReady } = useAuth();
    const sender = useResource('/manager/mail');
    const groups = useResource('/manager/groups');
    const [groupId, setGroupId] = useState('');
    const [selection, setSelection] = useState(null);
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [preview, setPreview] = useState(null);
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [uncertain, setUncertain] = useState(false);
    const dispatching = useRef(false);
    const url = '/manager/broadcasts/recipients' + (groupId ? '?groupId=' + groupId : '');
    const list = useResource(url, fields?.map((f) => f.key).join(','));
    const users = list.data?.users || [];
    const selected = users.filter((u) => (selection ? selection.includes(u.id) : Boolean(groupId)));
    // 미리보기에는 회원 번호만 저장하고, 이름·주소는 현재 설정으로 조회한 목록에서 읽는다.
    const recipients = preview ? users.filter((user) => preview.userIds.includes(user.id)) : [];
    const completeList = preview && recipients.length === preview.userIds.length;
    const ready =
        fieldsReady && sender.data?.sender && sender.data.connectionStatus !== 'auth_failed';

    function review(event) {
        event.preventDefault();
        if (!selected.length || !ready) return;
        if (!subject.trim() || !body.trim()) return setMessage('제목과 본문을 입력하세요.');
        setMessage('');
        setUncertain(false);
        setPreview({
            requestId: crypto.randomUUID(),
            groupId: groupId ? Number(groupId) : null,
            userIds: selected.map((u) => u.id),
            subject: subject.trim(),
            body: body.trim(),
        });
    }

    async function send() {
        if (dispatching.current || !completeList || !ready) return;
        dispatching.current = true;
        setSending(true);
        const payload = preview;
        remember(storageKey, payload.requestId);
        try {
            await api('POST', '/manager/broadcasts', payload);
            onSubmitted(payload.requestId);
        } catch (error) {
            if (error.status && error.status < 500) {
                remember(storageKey, null);
                setPreview(null);
                list.reload();
                setMessage(error.message);
            } else {
                setUncertain(true);
                setMessage(
                    '접수 결과를 확인할 수 없습니다. 같은 요청으로 다시 확인할 수 있습니다.',
                );
            }
        } finally {
            dispatching.current = false;
            setSending(false);
        }
    }

    return (
        <section>
            <h3>학생 메일 발송</h3>
            {sender.data && (
                <p>
                    발신 주소 · {sender.data.sender || '미등록'} ·{' '}
                    <Link to="/manager?tab=mail">발신 계정 관리</Link>
                </p>
            )}
            {sender.data?.connectionStatus === 'auth_failed' && (
                <p>발신 계정 인증이 거절됐습니다. 메일 관리에서 연결을 확인하세요.</p>
            )}
            <p role="status">{message || sender.error || groups.error || list.error}</p>
            {preview ? (
                <section>
                    <h4>발송 전 확인</h4>
                    <p>받는 학생 {preview.userIds.length}명 · 각 학생에게 개별 발송</p>
                    {list.data && !completeList && (
                        <p>수신 대상이 달라졌습니다. 돌아가서 다시 선택하세요.</p>
                    )}
                    <ul>
                        {recipients.map((u) => {
                            const label = memberLabel(u, fields);
                            return (
                                <li key={u.id}>
                                    {label}
                                    {label !== u.email && ' · ' + u.email}
                                </li>
                            );
                        })}
                    </ul>
                    <strong>{preview.subject}</strong>
                    <p className="content">{preview.body}</p>
                    <button
                        type="button"
                        disabled={sending || !ready || !completeList}
                        onClick={send}
                    >
                        {sending
                            ? '접수 중…'
                            : uncertain
                              ? '같은 요청으로 접수 재확인'
                              : preview.userIds.length + '명에게 발송'}
                    </button>
                    {uncertain ? (
                        <button
                            type="button"
                            disabled={sending}
                            onClick={() => onSubmitted(preview.requestId)}
                        >
                            접수 결과 조회
                        </button>
                    ) : (
                        <button type="button" disabled={sending} onClick={() => setPreview(null)}>
                            돌아가서 수정
                        </button>
                    )}
                </section>
            ) : (
                <form onSubmit={review}>
                    <Field
                        label="수신 대상"
                        as="select"
                        value={groupId}
                        onChange={(event) => {
                            setGroupId(event.target.value);
                            setSelection(null);
                            setMessage('');
                        }}
                    >
                        <option value="">전체 학생 중 선택</option>
                        {groups.data?.groups.map((g) => (
                            <option key={g.id} value={g.id}>
                                {g.name}
                            </option>
                        ))}
                    </Field>
                    <StudentChecklist
                        students={users}
                        selectedIds={selected.map((u) => u.id)}
                        onChange={setSelection}
                        label="받는 학생"
                        disabled={!list.data}
                        showEmail
                    />
                    <Field
                        label="메일 제목"
                        value={subject}
                        onChange={(event) => setSubject(event.target.value)}
                        maxLength={160}
                        required
                    />
                    <Field
                        label="메일 본문"
                        as="textarea"
                        value={body}
                        onChange={(event) => setBody(event.target.value)}
                        maxLength={10000}
                        required
                    />
                    <button disabled={!ready || !selected.length}>발송 전 확인</button>
                </form>
            )}
        </section>
    );
}

function BroadcastReceipt({ id, onNew }) {
    const report = useResource('/manager/broadcasts/' + id);
    const { fields } = useAuth();
    const members = useResource(
        report.data ? '/manager/users' : null,
        fields?.map((f) => f.key).join(','),
    );
    const labels = new Map(members.data?.users.map((u) => [u.id, memberLabel(u, fields)]));
    const { reload } = report;
    useEffect(() => {
        if (report.data?.status !== 'sending' || report.error) return;
        const timer = setInterval(reload, 2500);
        return () => clearInterval(timer);
    }, [report.data?.status, report.error, reload]);
    return (
        <section>
            <h3>메일 발송 결과</h3>
            <p role="status">{report.error || report.data?.message || '발송 결과 확인 중…'}</p>
            {report.data && (
                <ul>
                    {report.data.recipients.map(({ userId, status }) => (
                        <li key={userId}>
                            {labels.get(userId) || '회원 ' + userId} · {results[status]}
                        </li>
                    ))}
                </ul>
            )}
            {report.error && (
                <button type="button" onClick={reload}>
                    결과 다시 확인
                </button>
            )}
            {(report.error || report.data?.status === 'complete') && (
                <button type="button" onClick={onNew}>
                    새 메일 작성
                </button>
            )}
        </section>
    );
}
