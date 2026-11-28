import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../shared/auth';
import { api } from '../shared/api';
import { useAction, useResource } from '../shared/hooks';
import { DeleteButton, Field, Form, Page } from '../shared/components';

export default function InfoPage() {
    const { user } = useAuth();
    return (
        <Page
            title="학원 소개 · Q&A"
            slug="info"
            fallback={<p>MathSite는 강좌와 강의 영상을 제공하는 수학 학원 사이트입니다.</p>}
        >
            <h3>Q&A</h3>
            {user ? (
                <Questions user={user} />
            ) : (
                <p>
                    질문을 보거나 작성하려면 <Link to="/login">로그인</Link>하세요.
                </p>
            )}
        </Page>
    );
}

function Questions({ user }) {
    const [selectedId, setSelectedId] = useState(null);
    const [draftKey, setDraftKey] = useState(0);
    const questionPath = selectedId ? '/info/qna/' + selectedId : '/info/qna';
    const list = useResource('/info/qna');
    const detail = useResource(selectedId ? questionPath : null);
    const selected = detail.data?.question;
    const editable = !selected || selected.user_id === user.id;
    const action = useAction();
    function reset() {
        setSelectedId(null);
        setDraftKey((value) => value + 1);
        list.reload();
    }
    function saveQuestion(form) {
        const method = selected ? 'PATCH' : 'POST';
        const body = {
            title: form.get('title'),
            content: form.get('content'),
            isPrivate: form.has('isPrivate'),
        };
        return action.run(() => api(method, questionPath, body), reset);
    }
    function deleteQuestion() {
        return action.run(() => api('DELETE', questionPath), reset);
    }
    function saveAnswer(form) {
        const method = selected.answer === null ? 'POST' : 'PATCH';
        const body = { answer: form.get('answer') };
        return action.run(() => api(method, questionPath + '/answer', body), detail.reload);
    }
    function deleteAnswer() {
        return action.run(() => api('DELETE', questionPath + '/answer'), detail.reload);
    }
    return (
        <section>
            <p role="status">{action.message || list.error || detail.error}</p>
            <ul>
                {list.data?.questions.map((question) => (
                    <li key={question.id}>
                        <button onClick={() => setSelectedId(question.id)}>{question.title}</button>
                    </li>
                ))}
            </ul>
            <button onClick={reset}>새 질문</button>
            {(!selectedId || selected) && (
                <>
                    <h3>{selected ? '질문 상세' : '질문 작성'}</h3>
                    <Form
                        key={selectedId || `new-${draftKey}`}
                        busy={action.busy}
                        onSubmit={saveQuestion}
                    >
                        <Field
                            label="제목"
                            name="title"
                            defaultValue={selected?.title || ''}
                            readOnly={!editable}
                            maxLength={160}
                            required
                        />
                        <Field
                            label="내용"
                            as="textarea"
                            name="content"
                            defaultValue={selected?.content || ''}
                            readOnly={!editable}
                            required
                        />
                        <Field
                            label="비공개 질문"
                            name="isPrivate"
                            type="checkbox"
                            defaultChecked={selected ? Boolean(selected.is_private) : true}
                            disabled={!editable}
                        />
                        {editable && <button>저장</button>}
                        {selected && (editable || user.canManage) && (
                            <DeleteButton key={selected.id} onDelete={deleteQuestion} />
                        )}
                    </Form>
                </>
            )}
            {selected && (
                <section>
                    <h3>답변</h3>
                    <p className="content">{selected.answer || '등록된 답변이 없습니다.'}</p>
                    {user.canManage && (
                        <Form
                            key={`${selected.id}:${selected.answer}`}
                            busy={action.busy}
                            onSubmit={saveAnswer}
                        >
                            <Field
                                label="답변"
                                as="textarea"
                                name="answer"
                                defaultValue={selected.answer || ''}
                                required
                            />
                            <button>답변 저장</button>
                            {selected.answer !== null && (
                                <DeleteButton onDelete={deleteAnswer}>답변 삭제</DeleteButton>
                            )}
                        </Form>
                    )}
                </section>
            )}
        </section>
    );
}
